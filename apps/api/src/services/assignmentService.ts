import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  AppError,
  AuthorizationError,
  NotFoundError,
  TenantError,
} from "../utils/errors";
import {
  assertSameSchool,
  assertTeacherAssigned,
  resolveStudentId,
  resolveTeacherId,
  scope,
} from "./academicsService";

// ============================================================
// Assignment lifecycle: DRAFT -> PUBLISHED -> CLOSED -> ARCHIVED
// Submission lifecycle: NOT_SUBMITTED -> SUBMITTED -> UNDER_REVIEW
//   -> GRADED, with LATE_SUBMITTED / RETURNED_FOR_REVISION /
//   RESUBMITTED branches. All transitions are validated here.
// Deadlines are absolute UTC instants; the school's configured
// timezone (School.timezone) is used for display/relative text.
// ============================================================

const ASSIGNMENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["CLOSED", "ARCHIVED"],
  CLOSED: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: [],
};

export interface AssignmentStats {
  total: number;
  submitted: number;
  pending: number;
  late: number;
  reviewed: number;
  graded: number;
  returnedForRevision: number;
  averageMarks: number | null;
}

const assignmentInclude = {
  class: { select: { id: true, name: true, code: true } },
  section: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
} as const;

function studentScope(a: { classId: string; sectionId: string | null; schoolId: string }) {
  const where: any = { schoolId: a.schoolId, classId: a.classId, status: "ACTIVE" };
  if (a.sectionId) where.sectionId = a.sectionId;
  return where;
}

export async function getSchoolTimezone(schoolId: string): Promise<string> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { timezone: true } });
  return school?.timezone || "Asia/Kolkata";
}

export function formatInTimezone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone, day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

async function computeStats(a: {
  id: string; classId: string; sectionId: string | null; schoolId: string;
}): Promise<AssignmentStats> {
  const [students, submissions] = await Promise.all([
    prisma.student.findMany({ where: studentScope(a), select: { id: true } }),
    prisma.assignmentSubmission.findMany({
      where: { assignmentId: a.id },
      select: { studentId: true, status: true, isLate: true, marksObtained: true },
    }),
  ]);
  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));
  let submitted = 0;
  let late = 0;
  let reviewed = 0;
  let graded = 0;
  let returned = 0;
  let marksSum = 0;
  let marksCount = 0;
  for (const st of students) {
    const sub = byStudent.get(st.id);
    if (!sub || sub.status === "NOT_SUBMITTED") continue;
    submitted += 1;
    if (sub.isLate) late += 1;
    if (sub.status === "UNDER_REVIEW" || sub.status === "GRADED") reviewed += 1;
    if (sub.status === "GRADED") {
      graded += 1;
      if (typeof sub.marksObtained === "number") {
        marksSum += sub.marksObtained;
        marksCount += 1;
      }
    }
    if (sub.status === "RETURNED_FOR_REVISION") returned += 1;
  }
  const total = students.length;
  return {
    total,
    submitted,
    pending: Math.max(0, total - submitted),
    late,
    reviewed,
    graded,
    returnedForRevision: returned,
    averageMarks: marksCount ? Math.round((marksSum / marksCount) * 100) / 100 : null,
  };
}

async function notifyUsers(
  userIds: string[],
  schoolId: string,
  title: string,
  message: string,
  link: string
) {
  try {
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    if (!unique.length) return 0;
    const existing = await prisma.notification.findMany({
      where: { userId: { in: unique }, link, isRead: false },
      select: { userId: true },
    });
    const already = new Set(existing.map((n) => n.userId));
    const rows = unique
      .filter((id) => !already.has(id))
      .map((userId) => ({ userId, title, message, type: "IN_APP" as const, link, schoolId }));
    if (!rows.length) return 0;
    let count = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const res = await prisma.notification.createMany({ data: rows.slice(i, i + 500) });
      count += res.count;
    }
    return count;
  } catch {
    return 0;
  }
}

async function notifyAssignmentPublished(a: {
  id: string; title: string; classId: string; sectionId: string | null;
  schoolId: string; dueDate: Date;
}) {
  const students = await prisma.student.findMany({
    where: studentScope(a),
    select: { userId: true },
  });
  const tz = await getSchoolTimezone(a.schoolId);
  await notifyUsers(
    students.map((s) => s.userId).filter((u): u is string => Boolean(u)),
    a.schoolId,
    `New assignment: ${a.title}`,
    `Assignment "${a.title}" is due ${formatInTimezone(a.dueDate, tz)}. Open Assignments to view instructions.`,
    `assignment:${a.id}`
  );
}

async function notifyTeachersOnSubmit(a: {
  id: string; title: string; teacherId: string | null; createdBy: string | null; schoolId: string;
}, studentName: string) {
  const ids: string[] = [];
  if (a.createdBy) ids.push(a.createdBy);
  if (a.teacherId) {
    const t = await prisma.teacher.findUnique({ where: { id: a.teacherId }, select: { userId: true } });
    if (t?.userId) ids.push(t.userId);
  }
  await notifyUsers(
    ids,
    a.schoolId,
    `Submission received: ${a.title}`,
    `${studentName} submitted "${a.title}". Open the submission list to review.`,
    `assignment:${a.id}:submissions`
  );
}

async function assertTeacherForAssignment(auth: AuthUser, a: { classId: string; subjectId: string | null }) {
  if (auth.roleName === "TEACHER") {
    await assertTeacherAssigned(auth, a.classId, a.subjectId);
  }
}

/** Backend role gate: students/parents can never mutate or review — enforced here, not just in the UI. */
function forbidLearner(auth: AuthUser) {
  if (auth.roleName === "STUDENT" || auth.roleName === "PARENT") {
    throw new AuthorizationError("Not allowed for this role");
  }
}

function parseDate(value: string | undefined | null, field: string): Date | undefined {
  if (value === undefined || value === null) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AuthorizationError(`Invalid ${field}`);
  return d;
}

export const assignmentService = {
  getSchoolTimezone,
  formatInTimezone,

  /* ---------------- Queries ---------------- */

  async listAssignments(auth: AuthUser, query: {
    classId?: string; sectionId?: string; subjectId?: string; type?: string;
    status?: string; search?: string; overdue?: string; schoolId?: string;
  }) {
    const schoolId = scope(auth, query.schoolId);
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (query.classId) {
      const cls = await prisma.schoolClass.findUnique({ where: { id: query.classId }, select: { schoolId: true } });
      if (!cls) throw new NotFoundError("Class");
      await assertSameSchool(schoolId, cls.schoolId, "Class");
      where.classId = query.classId;
    } else if (auth.roleName === "TEACHER") {
      const teacherId = await resolveTeacherId(auth);
      const entries = teacherId
        ? await prisma.timetable.findMany({ where: { teacherId }, select: { classId: true } })
        : [];
      const ids = Array.from(new Set(entries.map((e) => e.classId)));
      const owned = teacherId
        ? await prisma.schoolClass.findMany({ where: { classTeacherId: teacherId }, select: { id: true } })
        : [];
      for (const c of owned) if (!ids.includes(c.id)) ids.push(c.id);
      where.classId = { in: ids.length ? ids : ["__none__"] };
    }
    if (query.sectionId) where.sectionId = query.sectionId;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.search) where.title = { contains: query.search, mode: "insensitive" };
    if (query.overdue === "true") where.dueDate = { lt: new Date() };

    const items = await prisma.assignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: { dueDate: "asc" },
      take: 200,
    });
    return Promise.all(items.map(async (a) => ({ ...a, stats: await computeStats(a) })));
  },

  /** Teacher/admin detail: full submission rows included. */
  async getAssignment(auth: AuthUser, id: string) {
    const a = await prisma.assignment.findUnique({ where: { id }, include: assignmentInclude });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    await assertTeacherForAssignment(auth, a);
    const stats = await computeStats(a);
    return { ...a, stats };
  },

  /* ---------------- Mutations ---------------- */

  async createAssignment(auth: AuthUser, data: {
    title: string; description?: string; instructions?: string; classId: string;
    sectionId?: string; subjectId?: string; academicYearId?: string; type?: string;
    assignedDate?: string; dueDate: string; lateSubmissionDate?: string;
    allowLateSubmission?: boolean; totalMarks?: number; passingMarks?: number;
    gradingCriteria?: string; referenceMaterials?: string[]; attachments?: string[];
    status?: string; schoolId?: string;
  }) {
    forbidLearner(auth);
    const schoolId = scope(auth, data.schoolId);
    if (!schoolId) throw new TenantError("School context required");
    const cls = await prisma.schoolClass.findUnique({ where: { id: data.classId } });
    if (!cls) throw new NotFoundError("Class");
    await assertSameSchool(schoolId, cls.schoolId, "Class");
    let teacherId: string | null = null;
    if (auth.roleName === "TEACHER") {
      teacherId = await assertTeacherAssigned(auth, data.classId, data.subjectId);
    } else if (auth.teacherId) {
      teacherId = auth.teacherId;
    }
    if (data.sectionId) {
      const section = await prisma.section.findUnique({ where: { id: data.sectionId } });
      if (!section || section.classId !== data.classId) throw new NotFoundError("Section");
    }
    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) throw new NotFoundError("Subject");
      await assertSameSchool(schoolId, (subject as any).schoolId, "Subject");
    }
    if (data.academicYearId) {
      const ay = await prisma.academicYear.findUnique({ where: { id: data.academicYearId } });
      if (!ay) throw new NotFoundError("Academic year");
      await assertSameSchool(schoolId, ay.schoolId, "Academic year");
    }
    const due = parseDate(data.dueDate, "due date") as Date;
    const assigned = parseDate(data.assignedDate, "assigned date") ?? new Date();
    const lateDate = parseDate(data.lateSubmissionDate ?? undefined, "late submission date");
    if (lateDate && lateDate <= due) throw new AuthorizationError("Late submission date must be after the due date");
    if (data.passingMarks !== undefined && data.totalMarks !== undefined && data.passingMarks > data.totalMarks) {
      throw new AuthorizationError("Passing marks cannot exceed total marks");
    }

    const created = await prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        classId: data.classId,
        sectionId: data.sectionId,
        subjectId: data.subjectId,
        teacherId,
        academicYearId: data.academicYearId,
        type: (data.type as any) ?? "INDIVIDUAL",
        assignedDate: assigned,
        dueDate: due,
        lateSubmissionDate: lateDate,
        allowLateSubmission: data.allowLateSubmission ?? false,
        totalMarks: data.totalMarks,
        passingMarks: data.passingMarks,
        gradingCriteria: data.gradingCriteria,
        referenceMaterials: data.referenceMaterials ?? [],
        attachments: data.attachments ?? [],
        status: (data.status as any) ?? "PUBLISHED",
        createdBy: auth.id,
        schoolId,
      },
      include: assignmentInclude,
    });
    if (created.status === "PUBLISHED") await notifyAssignmentPublished(created);
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "ASSIGNMENT",
        entityId: created.id, schoolId,
        newValue: { title: created.title, classId: data.classId, status: created.status },
      },
    });
    return { ...created, stats: await computeStats(created) };
  },

  async updateAssignment(auth: AuthUser, id: string, data: {
    title?: string; description?: string | null; instructions?: string | null;
    sectionId?: string | null; subjectId?: string | null; academicYearId?: string | null;
    type?: string; assignedDate?: string; dueDate?: string; lateSubmissionDate?: string | null;
    allowLateSubmission?: boolean; totalMarks?: number | null; passingMarks?: number | null;
    gradingCriteria?: string | null; referenceMaterials?: string[] | null; attachments?: string[] | null;
    status?: string;
  }) {
    forbidLearner(auth);
    const a = await prisma.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    await assertTeacherForAssignment(auth, a);
    if (data.status && data.status !== a.status) {
      const allowed = ASSIGNMENT_TRANSITIONS[a.status] ?? [];
      if (!allowed.includes(data.status)) {
        throw new AuthorizationError(`Cannot move assignment from ${a.status} to ${data.status}`);
      }
    }
    if (data.sectionId) {
      const section = await prisma.section.findUnique({ where: { id: data.sectionId } });
      if (!section || section.classId !== a.classId) throw new NotFoundError("Section");
    }
    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) throw new NotFoundError("Subject");
      await assertSameSchool(schoolId, (subject as any).schoolId, "Subject");
    }
    const patch: any = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.instructions !== undefined) patch.instructions = data.instructions;
    if (data.sectionId !== undefined) patch.sectionId = data.sectionId;
    if (data.subjectId !== undefined) patch.subjectId = data.subjectId;
    if (data.academicYearId !== undefined) patch.academicYearId = data.academicYearId;
    if (data.type !== undefined) patch.type = data.type;
    if (data.assignedDate !== undefined) patch.assignedDate = parseDate(data.assignedDate, "assigned date");
    if (data.dueDate !== undefined) patch.dueDate = parseDate(data.dueDate, "due date");
    if (data.lateSubmissionDate !== undefined) {
      patch.lateSubmissionDate = data.lateSubmissionDate ? parseDate(data.lateSubmissionDate, "late submission date") : null;
    }
    if (data.allowLateSubmission !== undefined) patch.allowLateSubmission = data.allowLateSubmission;
    if (data.totalMarks !== undefined) patch.totalMarks = data.totalMarks;
    if (data.passingMarks !== undefined) patch.passingMarks = data.passingMarks;
    if (data.gradingCriteria !== undefined) patch.gradingCriteria = data.gradingCriteria;
    if (data.referenceMaterials !== undefined) patch.referenceMaterials = data.referenceMaterials ?? [];
    if (data.attachments !== undefined) patch.attachments = data.attachments ?? [];
    if (data.status !== undefined) patch.status = data.status;

    const effectiveDue = patch.dueDate ?? a.dueDate;
    const effectiveLate = patch.lateSubmissionDate !== undefined ? patch.lateSubmissionDate : a.lateSubmissionDate;
    if (effectiveLate && effectiveLate <= effectiveDue) {
      throw new AuthorizationError("Late submission date must be after the due date");
    }
    const effectiveTotal = patch.totalMarks !== undefined ? patch.totalMarks : a.totalMarks;
    const effectivePass = patch.passingMarks !== undefined ? patch.passingMarks : a.passingMarks;
    if (effectiveTotal != null && effectivePass != null && effectivePass > effectiveTotal) {
      throw new AuthorizationError("Passing marks cannot exceed total marks");
    }

    const wasPublished = a.status === "PUBLISHED";
    const updated = await prisma.assignment.update({ where: { id }, data: patch, include: assignmentInclude });
    if (updated.status === "PUBLISHED" && !wasPublished) await notifyAssignmentPublished(updated);
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "UPDATE", entity: "ASSIGNMENT",
        entityId: id, schoolId: a.schoolId, newValue: patch,
      },
    });
    return { ...updated, stats: await computeStats(updated) };
  },

  async transitionAssignment(auth: AuthUser, id: string, to: string) {
    forbidLearner(auth);
    const a = await prisma.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    await assertTeacherForAssignment(auth, a);
    const allowed = ASSIGNMENT_TRANSITIONS[a.status] ?? [];
    if (!allowed.includes(to)) {
      throw new AuthorizationError(`Cannot move assignment from ${a.status} to ${to}`);
    }
    const updated = await prisma.assignment.update({ where: { id }, data: { status: to as any }, include: assignmentInclude });
    if (to === "PUBLISHED") await notifyAssignmentPublished(updated);
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: to === "PUBLISHED" ? "PUBLISH" : "UPDATE", entity: "ASSIGNMENT",
        entityId: id, schoolId: a.schoolId, newValue: { from: a.status, to },
      },
    });
    return { ...updated, stats: await computeStats(updated) };
  },

  async duplicateAssignment(auth: AuthUser, id: string) {
    forbidLearner(auth);
    const a = await prisma.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    await assertTeacherForAssignment(auth, a);
    const copy = await prisma.assignment.create({
      data: {
        title: `${a.title} (copy)`,
        description: a.description,
        instructions: a.instructions,
        classId: a.classId,
        sectionId: a.sectionId,
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        academicYearId: a.academicYearId,
        type: a.type,
        assignedDate: new Date(),
        dueDate: a.dueDate,
        lateSubmissionDate: a.lateSubmissionDate,
        allowLateSubmission: a.allowLateSubmission,
        totalMarks: a.totalMarks,
        passingMarks: a.passingMarks,
        gradingCriteria: a.gradingCriteria,
        referenceMaterials: (a.referenceMaterials as any) ?? [],
        attachments: (a.attachments as any) ?? [],
        status: "DRAFT",
        createdBy: auth.id,
        schoolId: a.schoolId,
      },
      include: assignmentInclude,
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "ASSIGNMENT",
        entityId: copy.id, schoolId: a.schoolId, newValue: { duplicatedFrom: id },
      },
    });
    return { ...copy, stats: await computeStats(copy) };
  },

  async deleteAssignment(auth: AuthUser, id: string) {
    forbidLearner(auth);
    const a = await prisma.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    await assertTeacherForAssignment(auth, a);
    // Best-effort cleanup of uploaded file metadata linked to this assignment tree.
    const docs = await prisma.document.findMany({
      where: {
        schoolId: a.schoolId,
        OR: [
          { entityType: "ASSIGNMENT", entityId: id },
          { entityType: "ASSIGNMENT_SUBMISSION", entityId: { in: (await prisma.assignmentSubmission.findMany({ where: { assignmentId: id }, select: { id: true } })).map((s) => s.id) } },
        ],
      },
      select: { id: true },
    });
    await prisma.assignment.delete({ where: { id } });
    for (const d of docs) {
      try {
        await prisma.document.delete({ where: { id: d.id } });
      } catch { /* already gone */ }
    }
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "DELETE", entity: "ASSIGNMENT",
        entityId: id, schoolId: a.schoolId, oldValue: { title: a.title },
      },
    });
    return { success: true };
  },

  /* ---------------- Teacher: submissions & grading ---------------- */

  async listSubmissions(auth: AuthUser, assignmentId: string, query: { status?: string; search?: string }) {
    forbidLearner(auth);
    const a = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    await assertTeacherForAssignment(auth, a);
    const studentWhere: any = studentScope(a);
    if (query.search) {
      studentWhere.OR = [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { admissionNumber: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const [students, submissions] = await Promise.all([
      prisma.student.findMany({
        where: studentWhere,
        orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
        select: {
          id: true, firstName: true, lastName: true, admissionNumber: true,
          rollNumber: true, photo: true,
          section: { select: { id: true, name: true } },
        },
        take: 500,
      }),
      prisma.assignmentSubmission.findMany({
        where: { assignmentId },
        include: { history: { orderBy: { version: "desc" }, take: 5 } },
      }),
    ]);
    const byStudent = new Map(submissions.map((s) => [s.studentId, s]));
    let rows = students.map((st) => ({
      student: st,
      submission: byStudent.get(st.id) ?? {
        assignmentId, studentId: st.id, status: "NOT_SUBMITTED",
        submissionText: null, attachments: [], submittedAt: null, isLate: false,
        marksObtained: null, feedback: null, gradesPublished: false, version: 0,
      } as any,
    }));
    if (query.status) rows = rows.filter((r) => (r.submission as any).status === query.status);
    return { assignment: { ...a, stats: await computeStats(a) }, students: rows, stats: await computeStats(a) };
  },

  /** Bulk grading. Marks require submitted work; GRADED requires marks when totalMarks is set. */
  async gradeSubmissions(
    auth: AuthUser,
    assignmentId: string,
    updates: Array<{ studentId: string; marksObtained?: number | null; feedback?: string | null; status?: string }>
  ) {
    forbidLearner(auth);
    const a = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    await assertTeacherForAssignment(auth, a);
    const allowedGradeStatus = new Set(["UNDER_REVIEW", "GRADED", "RETURNED_FOR_REVISION", "NOT_SUBMITTED"]);
    for (const u of updates) {
      if (u.status && !allowedGradeStatus.has(u.status)) {
        throw new AuthorizationError(`Invalid grade status: ${u.status}`);
      }
      if (u.marksObtained != null) {
        if (u.marksObtained < 0) throw new AuthorizationError("Marks cannot be negative");
        if (a.totalMarks != null && u.marksObtained > a.totalMarks) {
          throw new AuthorizationError(`Marks cannot exceed total marks (${a.totalMarks})`);
        }
      }
      if (u.status === "GRADED" && a.totalMarks != null && u.marksObtained == null) {
        const existing = await prisma.assignmentSubmission.findUnique({
          where: { assignmentId_studentId: { assignmentId, studentId: u.studentId } },
          select: { marksObtained: true },
        });
        if (existing?.marksObtained == null) {
          throw new AuthorizationError("Marks are required to grade this assignment");
        }
      }
    }
    const inScope = await prisma.student.findMany({
      where: { ...studentScope(a), id: { in: updates.map((u) => u.studentId) } },
      select: { id: true },
    });
    const inScopeIds = new Set(inScope.map((s) => s.id));
    const rejected = updates.filter((u) => !inScopeIds.has(u.studentId));
    if (rejected.length) throw new AuthorizationError(`${rejected.length} student(s) not in this assignment scope`);

    const now = new Date();
    const results = [];
    for (const u of updates) {
      const current = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: u.studentId } },
      });
      if (u.marksObtained != null && !current?.submittedAt && current?.status === "NOT_SUBMITTED") {
        throw new AuthorizationError("Cannot assign marks without a submission");
      }
      if (!current) {
        // No submission row yet: only a review/return marker can be created, never marks.
        if (u.marksObtained != null || u.feedback) {
          throw new AuthorizationError("Cannot grade without a submission");
        }
        const created = await prisma.assignmentSubmission.create({
          data: {
            assignmentId, studentId: u.studentId, schoolId: a.schoolId,
            status: (u.status as any) ?? "NOT_SUBMITTED",
            reviewedBy: auth.id, reviewedAt: now,
          },
        });
        results.push(created);
        continue;
      }
      // Snapshot history before mutating graded work.
      await prisma.assignmentSubmissionHistory.create({
        data: {
          submissionId: current.id, assignmentId, studentId: u.studentId, schoolId: a.schoolId,
          version: current.version, status: current.status as any,
          submissionText: current.submissionText,
          attachments: (current.attachments as any) ?? [],
          marksObtained: current.marksObtained,
          feedback: current.feedback,
          createdBy: auth.id,
        },
      });
      const patch: any = { reviewedBy: auth.id, reviewedAt: now };
      if (u.marksObtained !== undefined) patch.marksObtained = u.marksObtained;
      if (u.feedback !== undefined) patch.feedback = u.feedback;
      if (u.status) {
        patch.status = u.status;
        if (u.status === "RETURNED_FOR_REVISION") patch.gradesPublished = false;
      } else if (u.marksObtained != null && current.status !== "GRADED") {
        patch.status = "UNDER_REVIEW"; // draft grading, not yet final
      }
      results.push(await prisma.assignmentSubmission.update({ where: { id: current.id }, data: patch }));
      if (patch.status === "RETURNED_FOR_REVISION") {
        const student = await prisma.student.findUnique({ where: { id: u.studentId }, select: { userId: true } });
        if (student?.userId) {
          await notifyUsers(
            [student.userId], a.schoolId,
            `Revision requested: ${a.title}`,
            `Your teacher requested changes on "${a.title}"${u.feedback ? `: ${u.feedback}` : ""}. Please resubmit.`,
            `assignment:${a.id}`
          );
        }
      }
    }
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "UPDATE", entity: "ASSIGNMENT_SUBMISSION",
        entityId: assignmentId, schoolId: a.schoolId, newValue: { graded: updates.length },
      },
    });
    return { updated: results.length, stats: await computeStats(a) };
  },

  /** Publish graded marks so students can see them. Notifies each graded student. */
  async publishGrades(auth: AuthUser, assignmentId: string, studentIds?: string[]) {
    forbidLearner(auth);
    const a = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    await assertTeacherForAssignment(auth, a);
    const where: any = { assignmentId, status: "GRADED" };
    if (studentIds?.length) where.studentId = { in: studentIds };
    const graded = await prisma.assignmentSubmission.findMany({
      where, select: { id: true, studentId: true },
    });
    await prisma.assignmentSubmission.updateMany({ where, data: { gradesPublished: true } });
    const students = await prisma.student.findMany({
      where: { id: { in: graded.map((g) => g.studentId) } },
      select: { userId: true },
    });
    await notifyUsers(
      students.map((s) => s.userId).filter((u): u is string => Boolean(u)),
      a.schoolId,
      `Grades published: ${a.title}`,
      `Your grade for "${a.title}" is now available. Open Assignments to view marks and feedback.`,
      `assignment:${a.id}`
    );
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "PUBLISH", entity: "ASSIGNMENT_GRADE",
        entityId: assignmentId, schoolId: a.schoolId, newValue: { published: graded.length },
      },
    });
    return { published: graded.length, stats: await computeStats(a) };
  },

  /* ---------------- Student: submit & view ---------------- */

  /** Student's own assignment feed: scope-filtered + own submission (marks hidden until published). */
  async studentAssignments(auth: AuthUser) {
    if (auth.roleName !== "STUDENT") throw new AuthorizationError("Students only");
    const studentId = await resolveStudentId(auth);
    if (!studentId) throw new NotFoundError("Linked student record");
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
    if (!student) throw new NotFoundError("Linked student record");
    const where: any = {
      schoolId: student.schoolId,
      classId: student.classId,
      status: "PUBLISHED",
      OR: [{ sectionId: null }, ...(student.sectionId ? [{ sectionId: student.sectionId }] : [])],
    };
    const [items, submissions] = await Promise.all([
      prisma.assignment.findMany({
        where,
        orderBy: { dueDate: "asc" },
        take: 100,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      }),
      prisma.assignmentSubmission.findMany({ where: { studentId } }),
    ]);
    const byAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));
    const now = Date.now();
    return items.map((a) => {
      const sub = byAssignment.get(a.id);
      const status = (sub?.status as string) ?? "NOT_SUBMITTED";
      const overdue = ["NOT_SUBMITTED", "RETURNED_FOR_REVISION"].includes(status) && new Date(a.dueDate).getTime() < now;
      const visible = sub && sub.gradesPublished
        ? { marksObtained: sub.marksObtained, feedback: sub.feedback }
        : { marksObtained: null, feedback: null };
      return {
        ...a,
        myStatus: overdue ? "OVERDUE" : status,
        submissionStatus: status,
        isOverdue: overdue,
        submission: sub
          ? {
              status: sub.status, submittedAt: sub.submittedAt, isLate: sub.isLate,
              submissionText: sub.submissionText, attachments: sub.attachments,
              version: sub.version, gradesPublished: sub.gradesPublished,
              ...visible,
            }
          : null,
      };
    });
  },

  async studentAssignmentDetail(auth: AuthUser, id: string) {
    const items = await this.studentAssignments(auth);
    const found = items.find((a) => a.id === id);
    if (!found) throw new NotFoundError("Assignment");
    const history: any[] = [];
    return { ...found, history };
  },

  /** Create or update the logged-in student's own submission with deadline + resubmit rules. */
  async studentSubmit(auth: AuthUser, assignmentId: string, data: { submissionText?: string | null; attachmentIds?: string[] }) {
    if (auth.roleName !== "STUDENT") throw new AuthorizationError("Students only");
    const studentId = await resolveStudentId(auth);
    if (!studentId) throw new NotFoundError("Linked student record");
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError("Linked student record");
    const a = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!a) throw new NotFoundError("Assignment");
    if (a.schoolId !== student.schoolId || a.classId !== student.classId) {
      throw new AuthorizationError("Not assigned this work");
    }
    if (a.sectionId && a.sectionId !== student.sectionId) {
      throw new AuthorizationError("Not assigned this work");
    }
    if (a.status !== "PUBLISHED") throw new AuthorizationError("Assignment is not open for submissions");

    const now = new Date();
    const pastDue = now.getTime() > a.dueDate.getTime();
    const lateOpen = a.allowLateSubmission && (!a.lateSubmissionDate || now.getTime() <= a.lateSubmissionDate.getTime());
    if (pastDue && !lateOpen) {
      throw new AppError("Submission deadline has passed", 400, "SUBMISSION_CLOSED");
    }
    if (!data.submissionText && !(data.attachmentIds?.length)) {
      throw new AppError("Submit text or at least one file", 400, "EMPTY_SUBMISSION");
    }

    const current = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });
    if (current?.gradesPublished && current.status === "GRADED") {
      throw new AuthorizationError("Grades are final — wait for your teacher to request a revision");
    }
    if (current && !["NOT_SUBMITTED", "SUBMITTED", "LATE_SUBMITTED", "UNDER_REVIEW", "RETURNED_FOR_REVISION", "RESUBMITTED"].includes(current.status as string)) {
      throw new AuthorizationError(`Cannot resubmit while status is ${current.status}`);
    }

    // Validate + link uploaded files (must be this student's own uploads in this school).
    let attachments: any[] = (current?.attachments as any[]) ?? [];
    if (data.attachmentIds?.length) {
      const docs = await prisma.document.findMany({ where: { id: { in: data.attachmentIds } } });
      if (docs.length !== data.attachmentIds.length) throw new NotFoundError("Attachment");
      for (const d of docs) {
        if (d.schoolId !== a.schoolId) throw new TenantError("Attachment belongs to another school");
        if (d.uploadedBy !== auth.id) throw new AuthorizationError("You can only attach your own uploads");
        if (!["ASSIGNMENT_UPLOAD", "ASSIGNMENT_SUBMISSION"].includes(d.entityType ?? "")) {
          throw new AuthorizationError("Attachment is not available for submissions");
        }
      }
      attachments = docs.map((d) => ({ documentId: d.id, name: d.name, mimeType: d.type, size: d.size }));
    }

    const isLate = pastDue;
    const nextStatus = isLate ? "LATE_SUBMITTED" : current?.status === "RETURNED_FOR_REVISION" ? "RESUBMITTED" : "SUBMITTED";
    let submission;
    if (!current) {
      submission = await prisma.assignmentSubmission.create({
        data: {
          assignmentId, studentId, schoolId: a.schoolId,
          status: nextStatus as any,
          submissionText: data.submissionText ?? undefined,
          attachments,
          submittedAt: now,
          isLate,
          version: 1,
        },
      });
      for (const docId of data.attachmentIds ?? []) {
        await prisma.document.update({ where: { id: docId }, data: { entityType: "ASSIGNMENT_SUBMISSION", entityId: submission.id } });
      }
    } else {
      // Snapshot history, then bump version.
      await prisma.assignmentSubmissionHistory.create({
        data: {
          submissionId: current.id, assignmentId, studentId, schoolId: a.schoolId,
          version: current.version, status: current.status as any,
          submissionText: current.submissionText,
          attachments: (current.attachments as any) ?? [],
          marksObtained: current.marksObtained,
          feedback: current.feedback,
          createdBy: auth.id,
        },
      });
      submission = await prisma.assignmentSubmission.update({
        where: { id: current.id },
        data: {
          status: nextStatus as any,
          submissionText: data.submissionText ?? current.submissionText,
          attachments,
          submittedAt: now,
          isLate,
          version: { increment: 1 },
        },
      });
      for (const docId of data.attachmentIds ?? []) {
        await prisma.document.update({ where: { id: docId }, data: { entityType: "ASSIGNMENT_SUBMISSION", entityId: submission.id } });
      }
    }
    const studentName = `${student.firstName} ${student.lastName}`.trim();
    await notifyTeachersOnSubmit(a, studentName || "A student");
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "ASSIGNMENT_SUBMISSION",
        entityId: submission.id, schoolId: a.schoolId,
        newValue: { assignmentId, status: nextStatus, version: submission.version, isLate },
      },
    });
    return submission;
  },

  async submissionHistory(auth: AuthUser, assignmentId: string, studentId?: string) {
    const a = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!a) throw new NotFoundError("Assignment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, a.schoolId, "Assignment");
    if (auth.roleName === "STUDENT") {
      const ownId = await resolveStudentId(auth);
      const target = studentId ?? ownId;
      if (!ownId || target !== ownId) throw new AuthorizationError("You can only view your own history");
      const sub = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: ownId } },
        include: { history: { orderBy: { version: "asc" } } },
      });
      if (!sub) return [];
      return sub.history;
    }
    await assertTeacherForAssignment(auth, a);
    if (!studentId) throw new AppError("studentId is required", 400, "VALIDATION_ERROR");
    const sub = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      include: { history: { orderBy: { version: "asc" } } },
    });
    return sub?.history ?? [];
  },

  /* ---------------- Attachments ---------------- */

  async uploadAttachment(auth: AuthUser, file: { buffer: Buffer; originalName: string; mimeType: string; size: number }) {
    const schoolId = scope(auth);
    if (!schoolId) throw new TenantError("School context required");
    const { storageService } = await import("./storage/storageService");
    return storageService.saveFile({
      ...file,
      schoolId,
      entityType: "ASSIGNMENT_UPLOAD",
      entityId: null,
      uploadedBy: auth.id,
    });
  },

  /** Authorize + resolve a file download. Never trusts client paths. */
  async authorizeAttachment(auth: AuthUser, documentId: string) {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundError("Attachment");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, doc.schoolId, "Attachment");
    const { storageService } = await import("./storage/storageService");

    if (doc.entityType === "ASSIGNMENT_UPLOAD") {
      const isOwner = doc.uploadedBy === auth.id;
      const isStaff = auth.isSuperAdmin || !["STUDENT", "PARENT"].includes(auth.roleName);
      if (!isOwner && !isStaff) throw new AuthorizationError("Not your upload");
      return storageService.resolveDownload(doc);
    }
    if (doc.entityType === "ASSIGNMENT_SUBMISSION") {
      const sub = await prisma.assignmentSubmission.findUnique({
        where: { id: doc.entityId ?? undefined },
        include: { assignment: { select: { classId: true, subjectId: true, schoolId: true } } },
      });
      if (!sub) throw new NotFoundError("Attachment");
      if (auth.roleName === "STUDENT") {
        const ownId = await resolveStudentId(auth);
        if (!ownId || sub.studentId !== ownId) throw new AuthorizationError("Not your submission");
      } else if (auth.roleName === "TEACHER") {
        await assertTeacherAssigned(auth, sub.assignment.classId, sub.assignment.subjectId);
      }
      return storageService.resolveDownload(doc);
    }
    if (doc.entityType === "ASSIGNMENT") {
      const a = await prisma.assignment.findUnique({
        where: { id: doc.entityId ?? undefined },
        select: { classId: true, sectionId: true, subjectId: true, schoolId: true },
      });
      if (!a) throw new NotFoundError("Attachment");
      if (auth.roleName === "STUDENT") {
        const ownId = await resolveStudentId(auth);
        const student = ownId ? await prisma.student.findUnique({ where: { id: ownId } }) : null;
        if (!student || student.schoolId !== a.schoolId || student.classId !== a.classId) {
          throw new AuthorizationError("Not assigned this work");
        }
        if (a.sectionId && student.sectionId !== a.sectionId) throw new AuthorizationError("Not assigned this work");
      } else if (auth.roleName === "TEACHER") {
        await assertTeacherAssigned(auth, a.classId, a.subjectId);
      }
      return storageService.resolveDownload(doc);
    }
    throw new AuthorizationError("Attachment is not part of assignments");
  },
};
