import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  AuthorizationError,
  NotFoundError,
  TenantError,
} from "../utils/errors";

async function resolveTeacherId(auth: AuthUser): Promise<string | null> {
  if (auth.teacherId) return auth.teacherId;
  const t = await prisma.teacher.findFirst({
    where: { email: auth.email, schoolId: auth.schoolId || undefined },
    select: { id: true },
  });
  return t?.id ?? null;
}

async function resolveStudentId(auth: AuthUser): Promise<string | null> {
  if (auth.studentId) {
    const s = await prisma.student.findUnique({
      where: { id: auth.studentId },
      select: { id: true },
    });
    if (s) return s.id;
  }
  const byEmail = await prisma.student.findFirst({
    where: { email: auth.email, schoolId: auth.schoolId || undefined },
    select: { id: true },
  });
  return byEmail?.id ?? null;
}

/** Teachers may manage homework for classes they teach (timetable) or own as class teacher. */
async function assertTeacherAssigned(auth: AuthUser, classId: string, subjectId?: string | null) {
  const teacherId = await resolveTeacherId(auth);
  if (!teacherId) throw new AuthorizationError("No linked teacher record");
  const cls = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { id: true, classTeacherId: true },
  });
  if (cls?.classTeacherId === teacherId) return teacherId;
  const where: any = { teacherId, classId };
  if (subjectId) where.subjectId = subjectId;
  let assigned = await prisma.timetable.findFirst({ where, select: { id: true } });
  if (!assigned && subjectId) {
    assigned = await prisma.timetable.findFirst({ where: { teacherId, classId }, select: { id: true } });
  }
  if (!assigned) throw new AuthorizationError("Not assigned to this class");
  return teacherId;
}

function scope(auth: AuthUser, schoolId?: string) {
  const ctx = auth.isSuperAdmin ? schoolId : auth.schoolId || undefined;
  if (!ctx && !auth.isSuperAdmin) throw new TenantError("School context required");
  return ctx;
}

async function assertSameSchool(
  schoolId: string | undefined,
  entitySchoolId: string,
  entityName: string
) {
  if (schoolId && entitySchoolId !== schoolId) {
    throw new TenantError(`${entityName} belongs to another school`);
  }
}

export interface HomeworkStats {
  total: number;
  completed: number;
  pending: number;
  notSubmitted: number;
  overdue: number;
}

async function studentScopeForHomework(homework: { classId: string; sectionId: string | null; schoolId: string }) {
  const where: any = { schoolId: homework.schoolId, classId: homework.classId, status: "ACTIVE" };
  if (homework.sectionId) where.sectionId = homework.sectionId;
  return where;
}

async function computeStats(homework: { id: string; classId: string; sectionId: string | null; schoolId: string; dueDate: Date }): Promise<HomeworkStats> {
  const where = await studentScopeForHomework(homework);
  const [students, submissions] = await Promise.all([
    prisma.student.findMany({ where, select: { id: true } }),
    prisma.homeworkSubmission.findMany({ where: { homeworkId: homework.id }, select: { studentId: true, status: true } }),
  ]);
  const byStudent = new Map(submissions.map((s) => [s.studentId, s.status]));
  let completed = 0;
  let notSubmitted = 0;
  for (const st of students) {
    const status = byStudent.get(st.id) ?? "PENDING";
    if (status === "COMPLETED") completed += 1;
    else if (status === "NOT_SUBMITTED") notSubmitted += 1;
  }
  const total = students.length;
  const pending = Math.max(0, total - completed - notSubmitted);
  const overdue = homework.dueDate.getTime() < Date.now() ? total - completed : 0;
  return { total, completed, pending, notSubmitted, overdue: Math.max(0, overdue) };
}

/** Backfill PENDING submission rows for every in-scope student (idempotent). */
async function ensureSubmissions(homework: { id: string; classId: string; sectionId: string | null; schoolId: string }) {
  const where = await studentScopeForHomework(homework);
  const students = await prisma.student.findMany({ where, select: { id: true } });
  if (!students.length) return 0;
  const rows = students.map((s) => ({ homeworkId: homework.id, studentId: s.id, schoolId: homework.schoolId }));
  const res = await prisma.homeworkSubmission.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

/** Best-effort in-app notifications to students (and their linked parent users where known). Never throws. */
async function notifyHomeworkPublished(homework: { id: string; title: string; classId: string; sectionId: string | null; schoolId: string; dueDate: Date }) {
  try {
    const where = await studentScopeForHomework(homework);
    const students = await prisma.student.findMany({
      where,
      select: { id: true, userId: true, firstName: true },
    });
    const withLogin = students.filter((s) => s.userId);
    if (!withLogin.length) return 0;
    const link = `/homework/${homework.id}`;
    const existing = await prisma.notification.findMany({
      where: { userId: { in: withLogin.map((s) => s.userId as string) }, link, isRead: false },
      select: { userId: true },
    });
    const already = new Set(existing.map((n) => n.userId));
    const rows = withLogin
      .filter((s) => !already.has(s.userId as string))
      .map((s) => ({
        userId: s.userId as string,
        title: `New homework: ${homework.title}`,
        message: `New homework "${homework.title}" is due ${homework.dueDate.toISOString().slice(0, 10)}. Open Homework to view instructions.`,
        type: "IN_APP" as const,
        link,
        schoolId: homework.schoolId,
      }));
    if (!rows.length) return 0;
    // createMany in chunks to stay within parameter limits
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

const homeworkInclude = {
  class: { select: { id: true, name: true, code: true } },
  section: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
} as const;

export const academicsService = {
  /* ---------------- Timetable ---------------- */

  async listTimetable(auth: AuthUser, query: { classId?: string; teacherId?: string; schoolId?: string }) {
    const schoolId = scope(auth, query.schoolId);
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (query.schoolId && auth.isSuperAdmin) where.schoolId = query.schoolId;

    if (auth.roleName === "TEACHER") {
      const teacherId = await resolveTeacherId(auth);
      where.teacherId = teacherId || "__none__";
    } else if (query.teacherId) {
      where.teacherId = query.teacherId;
    }
    if (query.classId) {
      const cls = await prisma.schoolClass.findUnique({
        where: { id: query.classId },
        select: { schoolId: true },
      });
      if (!cls) throw new NotFoundError("Class");
      await assertSameSchool(schoolId, cls.schoolId, "Class");
      where.classId = query.classId;
    }
    return prisma.timetable.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 500,
    });
  },

  async createTimetable(auth: AuthUser, data: {
    classId: string; subjectId: string; teacherId: string;
    dayOfWeek: number; startTime: string; endTime: string;
    room?: string; schoolId?: string;
  }) {
    const schoolId = scope(auth, data.schoolId);
    if (!schoolId) throw new TenantError("School context required");
    const [cls, subject, teacher] = await Promise.all([
      prisma.schoolClass.findUnique({ where: { id: data.classId } }),
      prisma.subject.findUnique({ where: { id: data.subjectId } }),
      prisma.teacher.findUnique({ where: { id: data.teacherId } }),
    ]);
    if (!cls) throw new NotFoundError("Class");
    if (!subject) throw new NotFoundError("Subject");
    if (!teacher) throw new NotFoundError("Teacher");
    await assertSameSchool(schoolId, cls.schoolId, "Class");
    await assertSameSchool(schoolId, (subject as any).schoolId, "Subject");
    await assertSameSchool(schoolId, teacher.schoolId, "Teacher");

    const entry = await prisma.timetable.create({
      data: {
        schoolId,
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "TIMETABLE",
        entityId: entry.id, schoolId, newValue: { classId: data.classId, subjectId: data.subjectId },
      },
    });
    return entry;
  },

  async deleteTimetable(auth: AuthUser, id: string) {
    const entry = await prisma.timetable.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError("Timetable entry");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, entry.schoolId, "Timetable entry");
    await prisma.timetable.delete({ where: { id } });
    return { success: true };
  },

  /* ---------------- Homework ---------------- */

  async listHomework(auth: AuthUser, query: {
    classId?: string; sectionId?: string; subjectId?: string;
    status?: string; priority?: string; search?: string;
    from?: string; to?: string; overdue?: string; schoolId?: string;
  }) {
    const schoolId = scope(auth, query.schoolId);
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (query.classId) {
      const cls = await prisma.schoolClass.findUnique({
        where: { id: query.classId },
        select: { schoolId: true },
      });
      if (!cls) throw new NotFoundError("Class");
      await assertSameSchool(schoolId, cls.schoolId, "Class");
      where.classId = query.classId;
    } else if (auth.roleName === "TEACHER") {
      const teacherId = await resolveTeacherId(auth);
      const entries = teacherId
        ? await prisma.timetable.findMany({ where: { teacherId }, select: { classId: true } })
        : [];
      const ids = Array.from(new Set(entries.map((e) => e.classId)));
      // also include classes the teacher owns as class teacher
      const owned = teacherId
        ? await prisma.schoolClass.findMany({ where: { classTeacherId: teacherId }, select: { id: true } })
        : [];
      for (const c of owned) if (!ids.includes(c.id)) ids.push(c.id);
      where.classId = { in: ids.length ? ids : ["__none__"] };
    }
    if (query.sectionId) where.sectionId = query.sectionId;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.search) where.title = { contains: query.search, mode: "insensitive" };
    if (query.from || query.to) {
      where.homeworkDate = {};
      if (query.from) where.homeworkDate.gte = new Date(query.from);
      if (query.to) where.homeworkDate.lte = new Date(query.to);
    }
    if (query.overdue === "true") where.dueDate = { lt: new Date() };

    const items = await prisma.homework.findMany({
      where,
      include: homeworkInclude,
      orderBy: { dueDate: "asc" },
      take: 200,
    });
    const withStats = await Promise.all(
      items.map(async (h) => ({ ...h, stats: await computeStats(h) }))
    );
    return withStats;
  },

  async getHomework(auth: AuthUser, id: string) {
    const hw = await prisma.homework.findUnique({ where: { id }, include: homeworkInclude });
    if (!hw) throw new NotFoundError("Homework");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, hw.schoolId, "Homework");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, hw.classId, hw.subjectId);
    }
    if (auth.roleName === "STUDENT") {
      const studentId = await resolveStudentId(auth);
      if (!studentId) throw new NotFoundError("Linked student record");
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { classId: true, sectionId: true, schoolId: true },
      });
      if (!student || student.schoolId !== hw.schoolId || student.classId !== hw.classId) {
        throw new AuthorizationError("Not assigned this homework");
      }
      if (hw.sectionId && student.sectionId !== hw.sectionId) {
        throw new AuthorizationError("Not assigned this homework");
      }
    }
    const stats = await computeStats(hw);
    return { ...hw, stats };
  },

  async createHomework(auth: AuthUser, data: {
    title: string; description?: string; classId: string;
    sectionId?: string; subjectId?: string; academicYearId?: string;
    homeworkDate?: string; dueDate: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    attachments?: string[]; schoolId?: string;
  }) {
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
    const due = new Date(data.dueDate);
    if (Number.isNaN(due.getTime())) throw new AuthorizationError("Invalid due date");
    const assignedAt = data.homeworkDate ? new Date(data.homeworkDate) : new Date();
    if (Number.isNaN(assignedAt.getTime())) throw new AuthorizationError("Invalid homework date");

    const hw = await prisma.homework.create({
      data: {
        title: data.title,
        description: data.description,
        classId: data.classId,
        sectionId: data.sectionId,
        subjectId: data.subjectId,
        teacherId,
        academicYearId: data.academicYearId,
        homeworkDate: assignedAt,
        dueDate: due,
        priority: (data.priority as any) ?? "MEDIUM",
        status: (data.status as any) ?? "PUBLISHED",
        attachments: data.attachments ?? [],
        createdBy: auth.id,
        schoolId,
      },
      include: homeworkInclude,
    });
    if (hw.status === "PUBLISHED") {
      await ensureSubmissions(hw);
      await notifyHomeworkPublished(hw);
    }
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "HOMEWORK",
        entityId: hw.id, schoolId, newValue: { title: hw.title, classId: data.classId, status: hw.status },
      },
    });
    const stats = await computeStats(hw);
    return { ...hw, stats };
  },

  async updateHomework(auth: AuthUser, id: string, data: {
    title?: string; description?: string | null; sectionId?: string | null;
    subjectId?: string | null; academicYearId?: string | null;
    homeworkDate?: string; dueDate?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    attachments?: string[] | null;
  }) {
    const hw = await prisma.homework.findUnique({ where: { id } });
    if (!hw) throw new NotFoundError("Homework");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, hw.schoolId, "Homework");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, hw.classId, hw.subjectId);
    }
    const wasPublished = hw.status === "PUBLISHED";
    if (data.sectionId) {
      const section = await prisma.section.findUnique({ where: { id: data.sectionId } });
      if (!section || section.classId !== hw.classId) throw new NotFoundError("Section");
    }
    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) throw new NotFoundError("Subject");
      await assertSameSchool(schoolId, (subject as any).schoolId, "Subject");
    }
    const patch: any = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.sectionId !== undefined) patch.sectionId = data.sectionId;
    if (data.subjectId !== undefined) patch.subjectId = data.subjectId;
    if (data.academicYearId !== undefined) patch.academicYearId = data.academicYearId;
    if (data.homeworkDate !== undefined) {
      const d = new Date(data.homeworkDate);
      if (Number.isNaN(d.getTime())) throw new AuthorizationError("Invalid homework date");
      patch.homeworkDate = d;
    }
    if (data.dueDate !== undefined) {
      const d = new Date(data.dueDate);
      if (Number.isNaN(d.getTime())) throw new AuthorizationError("Invalid due date");
      patch.dueDate = d;
    }
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.status !== undefined) patch.status = data.status;
    if (data.attachments !== undefined) patch.attachments = data.attachments ?? [];

    const updated = await prisma.homework.update({ where: { id }, data: patch, include: homeworkInclude });
    if (updated.status === "PUBLISHED" && !wasPublished) {
      await ensureSubmissions(updated);
      await notifyHomeworkPublished(updated);
    }
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "UPDATE", entity: "HOMEWORK",
        entityId: id, schoolId: hw.schoolId, newValue: patch,
      },
    });
    const stats = await computeStats(updated);
    return { ...updated, stats };
  },

  async deleteHomework(auth: AuthUser, id: string) {
    const hw = await prisma.homework.findUnique({ where: { id } });
    if (!hw) throw new NotFoundError("Homework");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, hw.schoolId, "Homework");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, hw.classId, hw.subjectId);
    }
    await prisma.homework.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "DELETE", entity: "HOMEWORK",
        entityId: id, schoolId: hw.schoolId, oldValue: { title: hw.title },
      },
    });
    return { success: true };
  },

  async publishHomework(auth: AuthUser, id: string) {
    const hw = await prisma.homework.findUnique({ where: { id } });
    if (!hw) throw new NotFoundError("Homework");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, hw.schoolId, "Homework");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, hw.classId, hw.subjectId);
    }
    const updated = await prisma.homework.update({
      where: { id }, data: { status: "PUBLISHED" }, include: homeworkInclude,
    });
    await ensureSubmissions(updated);
    const notified = await notifyHomeworkPublished(updated);
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "PUBLISH", entity: "HOMEWORK",
        entityId: id, schoolId: hw.schoolId, newValue: { status: "PUBLISHED" },
      },
    });
    const stats = await computeStats(updated);
    return { ...updated, stats, notified };
  },

  /** Student-wise completion roster: every in-scope student + their submission (missing = PENDING). */
  async listCompletions(auth: AuthUser, homeworkId: string, query: { status?: string; search?: string }) {
    const hw = await prisma.homework.findUnique({ where: { id: homeworkId }, include: homeworkInclude });
    if (!hw) throw new NotFoundError("Homework");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, hw.schoolId, "Homework");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, hw.classId, hw.subjectId);
    }
    const studentWhere: any = await studentScopeForHomework(hw);
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
      prisma.homeworkSubmission.findMany({ where: { homeworkId } }),
    ]);
    const byStudent = new Map(submissions.map((s) => [s.studentId, s]));
    let rows = students.map((st) => {
      const sub = byStudent.get(st.id);
      return { student: st, submission: sub ?? { homeworkId, studentId: st.id, status: "PENDING", submittedAt: null, teacherRemark: null, submissionText: null, attachmentUrl: null } };
    });
    if (query.status) rows = rows.filter((r) => (r.submission as any).status === query.status);
    const stats = await computeStats(hw);
    return { homework: { ...hw, stats }, students: rows, stats };
  },

  /** Teacher/admin bulk (or single) completion update. Upserts per-student rows — never duplicates. */
  async updateCompletions(auth: AuthUser, homeworkId: string, updates: Array<{ studentId: string; status: string; teacherRemark?: string | null }>) {
    const allowed = new Set(["PENDING", "COMPLETED", "NOT_SUBMITTED"]);
    for (const u of updates) {
      if (!allowed.has(u.status)) throw new AuthorizationError(`Invalid status: ${u.status}`);
    }
    const hw = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw) throw new NotFoundError("Homework");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, hw.schoolId, "Homework");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, hw.classId, hw.subjectId);
    }
    const scopeWhere: any = await studentScopeForHomework(hw);
    const inScope = await prisma.student.findMany({
      where: { ...scopeWhere, id: { in: updates.map((u) => u.studentId) } },
      select: { id: true },
    });
    const inScopeIds = new Set(inScope.map((s) => s.id));
    const rejected = updates.filter((u) => !inScopeIds.has(u.studentId));
    if (rejected.length) throw new AuthorizationError(`${rejected.length} student(s) not in this homework scope`);

    const now = new Date();
    await prisma.$transaction(
      updates.map((u) =>
        prisma.homeworkSubmission.upsert({
          where: { homeworkId_studentId: { homeworkId, studentId: u.studentId } },
          create: {
            homeworkId, studentId: u.studentId, schoolId: hw.schoolId,
            status: u.status as any,
            submittedAt: u.status === "COMPLETED" ? now : null,
            teacherRemark: u.teacherRemark ?? undefined,
          },
          update: {
            status: u.status as any,
            submittedAt: u.status === "COMPLETED" ? now : null,
            ...(u.teacherRemark !== undefined ? { teacherRemark: u.teacherRemark } : {}),
          },
        })
      )
    );
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "UPDATE", entity: "HOMEWORK_SUBMISSION",
        entityId: homeworkId, schoolId: hw.schoolId,
        newValue: { count: updates.length },
      },
    });
    const stats = await computeStats(hw);
    return { updated: updates.length, stats };
  },

  /** Logged-in student marks their own homework response (creates COMPLETED row). */
  async studentSubmit(auth: AuthUser, homeworkId: string, data: { submissionText?: string | null; attachmentUrl?: string | null }) {
    const hw = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw) throw new NotFoundError("Homework");
    if (hw.status !== "PUBLISHED") throw new AuthorizationError("Homework is not published");
    const studentId = await resolveStudentId(auth);
    if (!studentId) throw new NotFoundError("Linked student record");
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, classId: true, sectionId: true, schoolId: true },
    });
    if (!student || student.schoolId !== hw.schoolId || student.classId !== hw.classId) {
      throw new AuthorizationError("Not assigned this homework");
    }
    if (hw.sectionId && student.sectionId !== hw.sectionId) {
      throw new AuthorizationError("Not assigned this homework");
    }
    const sub = await prisma.homeworkSubmission.upsert({
      where: { homeworkId_studentId: { homeworkId, studentId } },
      create: {
        homeworkId, studentId, schoolId: hw.schoolId, status: "COMPLETED",
        submittedAt: new Date(),
        submissionText: data.submissionText ?? undefined,
        attachmentUrl: data.attachmentUrl ?? undefined,
      },
      update: {
        status: "COMPLETED",
        submittedAt: new Date(),
        ...(data.submissionText !== undefined ? { submissionText: data.submissionText } : {}),
        ...(data.attachmentUrl !== undefined ? { attachmentUrl: data.attachmentUrl } : {}),
      },
    });
    return sub;
  },

  /* ---------------- Assignments ---------------- */

  async listAssignments(auth: AuthUser, query: { classId?: string; schoolId?: string }) {
    const schoolId = scope(auth, query.schoolId);
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (query.classId) {
      const cls = await prisma.schoolClass.findUnique({
        where: { id: query.classId },
        select: { schoolId: true },
      });
      if (!cls) throw new NotFoundError("Class");
      await assertSameSchool(schoolId, cls.schoolId, "Class");
      where.classId = query.classId;
    } else if (auth.roleName === "TEACHER") {
      const teacherId = await resolveTeacherId(auth);
      const entries = teacherId
        ? await prisma.timetable.findMany({ where: { teacherId }, select: { classId: true } })
        : [];
      const ids = Array.from(new Set(entries.map((e) => e.classId)));
      where.classId = { in: ids.length ? ids : ["__none__"] };
    }
    return prisma.assignment.findMany({
      where,
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 200,
    });
  },

  async createAssignment(auth: AuthUser, data: {
    title: string; description?: string; classId: string;
    subjectId?: string; totalMarks?: number; dueDate: string; schoolId?: string;
  }) {
    const schoolId = scope(auth, data.schoolId);
    if (!schoolId) throw new TenantError("School context required");
    const cls = await prisma.schoolClass.findUnique({ where: { id: data.classId } });
    if (!cls) throw new NotFoundError("Class");
    await assertSameSchool(schoolId, cls.schoolId, "Class");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, data.classId);
    }
    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) throw new NotFoundError("Subject");
      await assertSameSchool(schoolId, (subject as any).schoolId, "Subject");
    }
    const a = await prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description,
        classId: data.classId,
        subjectId: data.subjectId,
        totalMarks: data.totalMarks,
        dueDate: new Date(data.dueDate),
        schoolId,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "ASSIGNMENT",
        entityId: a.id, schoolId, newValue: { title: a.title, classId: data.classId },
      },
    });
    return a;
  },
};
