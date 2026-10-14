import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  TenantError,
} from "../utils/errors";
import { getSchoolTimezone, formatInTimezone } from "./assignmentService";

interface CreateExamData {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  schoolId: string;
  academicYearId?: string;
  durationMin?: number;
  instructions?: string;
  gradingPolicy?: { boundaries?: Record<string, number>; rankEnabled?: boolean; tieMethod?: "dense" | "competition" };
  classes?: { classId: string; sectionId?: string }[];
  subjects: {
    subjectId: string;
    maxMarks: number;
    passMarks: number;
    date?: string;
    startTime?: string;
    endTime?: string;
    durationMin?: number;
    room?: string;
    invigilatorId?: string;
    instructions?: string;
  }[];
}

// Exam lifecycle: Draft -> Published(scheduled) -> In Progress -> Completed -> Archived.
// PUBLISHED here means results published (family-visible).
const EXAM_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SCHEDULED", "ARCHIVED"],
  SCHEDULED: ["IN_PROGRESS", "DRAFT", "ARCHIVED"],
  IN_PROGRESS: ["COMPLETED", "ARCHIVED"],
  COMPLETED: ["PUBLISHED", "IN_PROGRESS", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

const DEFAULT_GRADE_BOUNDARIES: Record<string, number> = {
  "A+": 90, A: 80, "B+": 70, B: 60, C: 50, D: 40,
};

function gradeFor(percentage: number, boundaries: Record<string, number>): string {
  const ordered = Object.entries(boundaries).sort((a, b) => b[1] - a[1]);
  for (const [grade, min] of ordered) {
    if (percentage >= min) return grade;
  }
  return "F";
}

function toMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

async function notifyExamUsers(
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

/** All student userIds in an exam's scoped classes/sections. */
async function examStudentUserIds(examId: string): Promise<{ schoolId: string; userIds: string[]; examName: string }> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, name: true, schoolId: true, classes: { select: { classId: true, sectionId: true } } },
  });
  if (!exam) return { schoolId: "", userIds: [], examName: "" };
  const or: any[] = [];
  for (const c of exam.classes) {
    or.push(c.sectionId ? { classId: c.classId, sectionId: c.sectionId } : { classId: c.classId });
  }
  const where: any = { schoolId: exam.schoolId, status: "ACTIVE" };
  if (or.length) where.OR = or;
  else {
    // Unscoped legacy exam: fall back to whole school.
    const students = await prisma.student.findMany({ where, select: { userId: true } });
    return { schoolId: exam.schoolId, userIds: students.map((s) => s.userId).filter((u): u is string => Boolean(u)), examName: exam.name };
  }
  const students = await prisma.student.findMany({ where, select: { userId: true } });
  return { schoolId: exam.schoolId, userIds: students.map((s) => s.userId).filter((u): u is string => Boolean(u)), examName: exam.name };
}

export const examService = {
  async create(data: CreateExamData) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ConflictError("Invalid exam dates");
    }
    if (end < start) {
      throw new ConflictError("Exam end date cannot be before start date");
    }
    if (data.academicYearId) {
      const ay = await prisma.academicYear.findUnique({ where: { id: data.academicYearId } });
      if (!ay || ay.schoolId !== data.schoolId) throw new NotFoundError("Academic year");
    }
    // Prevent duplicate exam schedules: same name + type in the same year/school.
    const duplicate = await prisma.exam.findFirst({
      where: {
        schoolId: data.schoolId,
        name: { equals: data.name, mode: "insensitive" },
        type: data.type,
        academicYearId: data.academicYearId ?? null,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictError("An exam with this name and type already exists for the academic year");
    }
    // Validate class/section scope + subjects before writing anything.
    const classRows = data.classes && data.classes.length ? data.classes : [];
    for (const c of classRows) {
      const cls = await prisma.schoolClass.findUnique({ where: { id: c.classId } });
      if (!cls || cls.schoolId !== data.schoolId) throw new NotFoundError("Class");
      if (c.sectionId) {
        const sec = await prisma.section.findUnique({ where: { id: c.sectionId } });
        if (!sec || sec.classId !== c.classId) throw new NotFoundError("Section");
      }
    }
    for (const sub of data.subjects) {
      const subject = await prisma.subject.findUnique({ where: { id: sub.subjectId } });
      if (!subject || (subject as any).schoolId !== data.schoolId) throw new NotFoundError("Subject");
      if (sub.passMarks > sub.maxMarks) {
        throw new ConflictError("Passing marks cannot exceed maximum marks");
      }
      if (sub.invigilatorId) {
        const inv = await prisma.teacher.findUnique({ where: { id: sub.invigilatorId } });
        if (!inv || inv.schoolId !== data.schoolId) throw new NotFoundError("Invigilator");
      }
    }

    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          name: data.name,
          type: data.type,
          startDate: start,
          endDate: end,
          schoolId: data.schoolId,
          academicYearId: data.academicYearId,
          durationMin: data.durationMin,
          instructions: data.instructions,
          gradingPolicy: (data.gradingPolicy as any) ?? undefined,
          status: "DRAFT",
        },
      });

      for (const c of classRows) {
        await tx.examClass.create({
          data: { examId: created.id, classId: c.classId, sectionId: c.sectionId ?? null, schoolId: data.schoolId },
        });
      }

      for (const sub of data.subjects) {
        await tx.examSubject.create({
          data: {
            examId: created.id,
            subjectId: sub.subjectId,
            maxMarks: sub.maxMarks,
            passMarks: sub.passMarks,
            date: sub.date ? new Date(sub.date) : null,
            startTime: sub.startTime || null,
            endTime: sub.endTime || null,
            durationMin: sub.durationMin ?? null,
            room: sub.room ?? null,
            invigilatorId: sub.invigilatorId ?? null,
            instructions: sub.instructions ?? null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "EXAM",
          entityId: created.id,
          schoolId: data.schoolId,
          newValue: { name: data.name, type: data.type },
        },
      });

      return created;
    });

    return this.getById(exam.id, data.schoolId, true);
  },

  async getById(id: string, schoolId: string | undefined, isSuperAdmin = false, auth?: AuthUser) {
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        subjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            invigilator: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { date: "asc" },
        },
        classes: {
          include: {
            class: { select: { id: true, name: true, code: true } },
            section: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundError("Exam");
    }

    if (!isSuperAdmin && schoolId && exam.schoolId !== schoolId) {
      throw new TenantError();
    }

    // Students/parents may only see scheduled/in-progress/published exams —
    // DRAFT and unpublished COMPLETED exams stay staff-only.
    if (!isSuperAdmin && (auth?.roleName === "STUDENT" || auth?.roleName === "PARENT")) {
      if (exam.status !== "SCHEDULED" && exam.status !== "IN_PROGRESS" && exam.status !== "PUBLISHED") {
        throw new AuthorizationError("This examination is not available yet");
      }
    }

    return exam;
  },

  async update(
    id: string,
    schoolId: string | undefined,
    data: Partial<CreateExamData>,
    isSuperAdmin = false
  ) {
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundError("Exam");
    }
    if (!isSuperAdmin && schoolId && exam.schoolId !== schoolId) {
      throw new TenantError();
    }
    // After results are published, structural edits are frozen — only
    // instructions may change (marks corrections go through the audited
    // marks flow). Rescheduling a published exam requires archiving first.
    if (exam.status === "PUBLISHED") {
      const structural = ["name", "type", "startDate", "endDate", "subjects", "classes", "academicYearId", "durationMin"];
      if (structural.some((k) => (data as any)[k] !== undefined)) {
        throw new ConflictError("Published exams are locked — archive the exam to make structural changes");
      }
    }
    if (data.startDate || data.endDate) {
      const start = data.startDate ? new Date(data.startDate) : exam.startDate;
      const end = data.endDate ? new Date(data.endDate) : exam.endDate;
      if (end < start) throw new ConflictError("Exam end date cannot be before start date");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.exam.update({
        where: { id },
        data: {
          name: data.name,
          type: data.type,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          durationMin: data.durationMin,
          instructions: data.instructions,
          gradingPolicy: (data.gradingPolicy as any) ?? undefined,
        },
      });

      if (data.classes) {
        await tx.examClass.deleteMany({ where: { examId: id } });
        for (const c of data.classes) {
          await tx.examClass.create({
            data: { examId: id, classId: c.classId, sectionId: c.sectionId ?? null, schoolId: exam.schoolId },
          });
        }
      }

      if (data.subjects && data.subjects.length > 0) {
        await tx.examSubject.deleteMany({ where: { examId: id } });
        for (const sub of data.subjects) {
          await tx.examSubject.create({
            data: {
              examId: id,
              subjectId: sub.subjectId,
              maxMarks: sub.maxMarks,
              passMarks: sub.passMarks,
              date: sub.date ? new Date(sub.date) : null,
              startTime: sub.startTime || null,
              endTime: sub.endTime || null,
              durationMin: sub.durationMin ?? null,
              room: sub.room ?? null,
              invigilatorId: sub.invigilatorId ?? null,
              instructions: sub.instructions ?? null,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "EXAM",
          entityId: id,
          schoolId: exam.schoolId,
          oldValue: { name: exam.name },
          newValue: { name: updated.name },
        },
      });

      return updated;
    });
  },

  async updateStatus(
    id: string,
    schoolId: string | undefined,
    status: string,
    isSuperAdmin = false,
    auth?: AuthUser
  ) {
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundError("Exam");
    }
    if (!isSuperAdmin && schoolId && exam.schoolId !== schoolId) {
      throw new TenantError();
    }
    const allowed = EXAM_TRANSITIONS[exam.status] ?? [];
    if (!allowed.includes(status)) {
      throw new ConflictError(`Cannot move exam from ${exam.status} to ${status}`);
    }

    // Publishing is privileged: require exam.publish (teachers hold
    // exam.marks only, so they can enter marks but never publish).
    if (status === "PUBLISHED" && !isSuperAdmin) {
      const perms = auth?.permissions || [];
      if (!perms.includes("exam.publish")) {
        throw new AuthorizationError("Publishing results requires exam.publish permission");
      }
      // All entered marks must be approved before results go out.
      const pending = await prisma.mark.count({
        where: { examSubject: { examId: id }, status: { in: ["DRAFT", "SUBMITTED", "REJECTED"] } },
      });
      if (pending > 0) {
        throw new ConflictError(`${pending} mark(s) are not approved yet — review them before publishing`);
      }
    }

    const updated = await prisma.exam.update({
      where: { id },
      data: { status: status as any, publishedAt: status === "PUBLISHED" ? new Date() : undefined },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth?.id,
        action: status === "PUBLISHED" ? "PUBLISH" : "UPDATE",
        entity: "EXAM",
        entityId: id,
        schoolId: exam.schoolId,
        newValue: { from: exam.status, to: status },
      },
    });

    // Notifications (in-app; other channels only if configured — see service).
    const tz = await getSchoolTimezone(exam.schoolId);
    if (status === "SCHEDULED") {
      const { userIds, schoolId: sid } = await examStudentUserIds(id);
      await notifyExamUsers(
        userIds, sid,
        `Exam scheduled: ${exam.name}`,
        `${exam.name} (${exam.type}) runs ${formatInTimezone(exam.startDate, tz)} – ${formatInTimezone(exam.endDate, tz)}. Check your timetable.`,
        `exam:${id}`
      );
    } else if (status === "PUBLISHED") {
      const { userIds, schoolId: sid } = await examStudentUserIds(id);
      await notifyExamUsers(
        userIds, sid,
        `Results published: ${exam.name}`,
        `Your ${exam.name} results are now available. Open Results to view your report card.`,
        `exam:${id}:results`
      );
    } else if (status === "ARCHIVED") {
      const { userIds, schoolId: sid } = await examStudentUserIds(id);
      await notifyExamUsers(
        userIds, sid,
        `Exam update: ${exam.name}`,
        `${exam.name} has been archived/cancelled. Contact the school office for details.`,
        `exam:${id}`
      );
    }
    return updated;
  },

  async delete(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundError("Exam");
    }
    if (!isSuperAdmin && schoolId && exam.schoolId !== schoolId) {
      throw new TenantError();
    }

    const subjectIds = (await prisma.examSubject.findMany({ where: { examId: id }, select: { id: true } })).map(
      (s) => s.id
    );
    await prisma.$transaction(async (tx) => {
      if (subjectIds.length) {
        await tx.markHistory.deleteMany({ where: { examSubjectId: { in: subjectIds } } });
      }
      await tx.mark.deleteMany({
        where: { examSubject: { examId: id } },
      });
      await tx.examSubject.deleteMany({ where: { examId: id } });
      await tx.examClass.deleteMany({ where: { examId: id } });

      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "EXAM",
          entityId: id,
          schoolId: exam.schoolId,
          oldValue: { name: exam.name },
        },
      });

      await tx.exam.delete({ where: { id } });
    });

    return { success: true };
  },

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    schoolId?: string;
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    type?: string;
    isSuperAdmin?: boolean;
    auth?: AuthUser;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));

    if (!query.schoolId && !query.isSuperAdmin) {
      throw new TenantError("School context required");
    }

    const where: any = {};
    if (query.schoolId) {
      where.schoolId = query.schoolId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { type: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const VISIBLE_TO_FAMILIES = ["SCHEDULED", "IN_PROGRESS", "PUBLISHED"];
    if (
      !query.isSuperAdmin &&
      (query.auth?.roleName === "STUDENT" || query.auth?.roleName === "PARENT")
    ) {
      // Students/parents never list DRAFT or unpublished COMPLETED exams,
      // even when an explicit ?status= filter is supplied.
      if (query.status && !VISIBLE_TO_FAMILIES.includes(query.status)) {
        throw new AuthorizationError("This examination list is not available");
      }
      where.status = { in: query.status ? [query.status] : VISIBLE_TO_FAMILIES };
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (query.type) where.type = query.type;
    if (query.classId || query.sectionId) {
      where.classes = {
        some: {
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        },
      };
    }

    const [total, exams] = await Promise.all([
      prisma.exam.count({ where }),
      prisma.exam.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startDate: "desc" },
        include: {
          subjects: {
            include: {
              subject: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: exams,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getDashboardStats(schoolId: string | undefined, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) {
      throw new TenantError("School context required");
    }

    const scope = schoolId ? { schoolId } : {};

    const now = new Date();

    const [total, scheduled, inProgress, completed, published, draftMarks, awaitingApproval, unenteredSubjects] = await Promise.all([
      prisma.exam.count({ where: scope }),
      prisma.exam.count({ where: { ...scope, status: "SCHEDULED" } }),
      prisma.exam.count({ where: { ...scope, status: "IN_PROGRESS" } }),
      prisma.exam.count({ where: { ...scope, status: "COMPLETED" } }),
      prisma.exam.count({ where: { ...scope, status: "PUBLISHED" } }),
      prisma.mark.count({
        where: { examSubject: { exam: scope }, status: "DRAFT" },
      }),
      prisma.mark.count({
        where: { examSubject: { exam: scope }, status: "SUBMITTED" },
      }),
      // Subjects in live exams with no marks entered at all.
      prisma.examSubject.count({
        where: {
          exam: { ...scope, status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] } },
          marks: { none: {} },
        },
      }),
    ]);

    const nextExam = await prisma.exam.findFirst({
      where: {
        ...scope,
        status: { in: ["SCHEDULED"] },
        startDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
      include: {
        subjects: {
          include: {
            subject: { select: { name: true } },
          },
        },
      },
    });

    const upcomingExams = await prisma.exam.findMany({
      where: {
        ...scope,
        status: { in: ["SCHEDULED"] },
        startDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
      take: 5,
      include: {
        subjects: {
          include: {
            subject: { select: { name: true } },
          },
        },
      },
    });

    const recentResults = await prisma.exam.findMany({
      where: {
        ...scope,
        status: "PUBLISHED",
      },
      orderBy: { endDate: "desc" },
      take: 5,
      include: {
        subjects: {
          include: {
            subject: { select: { name: true } },
          },
        },
      },
    });

    return {
      total,
      scheduled,
      inProgress,
      completed,
      published,
      pendingMarksEntry: draftMarks + unenteredSubjects,
      unenteredSubjects,
      awaitingApproval,
      nextExam,
      upcomingExams,
      recentResults,
    };
  },

  async getResults(
    examId: string,
    schoolId: string | undefined,
    isSuperAdmin = false,
    auth?: AuthUser
  ) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        subjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            marks: {
              include: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundError("Exam");
    }

    if (!isSuperAdmin && schoolId && exam.schoolId !== schoolId) {
      throw new TenantError();
    }

    // Unpublished marks must never leak: students/parents may only view
    // PUBLISHED exams (staff with exam.results use this for verification).
    // The mobile student path uses mobileService.studentResults which is
    // PUBLISHED-only; this guards direct GET /exams/:id/results access.
    if (!isSuperAdmin && exam.status !== "PUBLISHED") {
      const role = auth?.roleName;
      if (role === "STUDENT" || role === "PARENT" || !role) {
        throw new AuthorizationError("Results are not published yet");
      }
    }

    const policy = (exam.gradingPolicy as any) || {};
    const boundaries = { ...DEFAULT_GRADE_BOUNDARIES, ...(policy.boundaries || {}) };
    const rankEnabled = policy.rankEnabled === true;
    const tieMethod = policy.tieMethod === "competition" ? "competition" : "dense";

    const studentMap = new Map<
      string,
      {
        id: string;
        firstName: string;
        lastName: string;
        admissionNumber: string;
        totalMarks: number;
        totalObtained: number;
        totalMax: number;
        totalPass: number;
        passed: boolean;
        absentCount: number;
        exemptCount: number;
        subjects: {
          name: string;
          obtained: number | null;
          maxMarks: number;
          passMarks: number;
          passed: boolean;
          isAbsent: boolean;
          isExempt: boolean;
          remarks: string | null;
        }[];
      }
    >();

    for (const es of exam.subjects) {
      for (const mark of es.marks) {
        const sid = (mark.student as any).id;
        if (!studentMap.has(sid)) {
          studentMap.set(sid, {
            id: sid,
            firstName: (mark.student as any).firstName,
            lastName: (mark.student as any).lastName,
            admissionNumber: (mark.student as any).admissionNumber,
            totalMarks: 0,
            totalObtained: 0,
            totalMax: 0,
            totalPass: 0,
            passed: true,
            absentCount: 0,
            exemptCount: 0,
            subjects: [],
          });
        }
        const s = studentMap.get(sid)!;
        const isAbsent = (mark as any).isAbsent === true;
        const isExempt = (mark as any).isExempt === true;
        if (isExempt) {
          // Exempted subjects are excluded from totals entirely.
          s.exemptCount += 1;
          s.subjects.push({
            name: es.subject.name,
            obtained: null,
            maxMarks: es.maxMarks,
            passMarks: es.passMarks,
            passed: true,
            isAbsent: false,
            isExempt: true,
            remarks: mark.remarks,
          });
          continue;
        }
        const obtained = isAbsent ? 0 : mark.marksObtained || 0;
        s.totalObtained += obtained;
        s.totalMax += es.maxMarks;
        s.totalPass += es.passMarks;
        const passed = isAbsent ? false : obtained >= es.passMarks;
        if (isAbsent) s.absentCount += 1;
        s.subjects.push({
          name: es.subject.name,
          obtained: isAbsent ? null : mark.marksObtained,
          maxMarks: es.maxMarks,
          passMarks: es.passMarks,
          passed,
          isAbsent,
          isExempt: false,
          remarks: mark.remarks,
        });
        if (!passed) {
          s.passed = false;
        }
      }
    }

    const students = Array.from(studentMap.values()).map((s) => ({
      ...s,
      percentage: s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 0,
      grade: gradeFor(s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 0, boundaries),
    }));

    students.sort((a, b) => b.percentage - a.percentage);

    // Ranks only when the school policy enables them. Ties share a rank;
    // dense (1,2,2,3) by default, competition (1,2,2,4) if configured.
    if (rankEnabled) {
      let rank = 0;
      let lastPct: number | null = null;
      students.forEach((s, i) => {
        if (lastPct === null || s.percentage !== lastPct) {
          rank = tieMethod === "competition" ? i + 1 : rank + 1;
          lastPct = s.percentage;
        }
        (s as any).rank = rank;
      });
    }

    // Exam-period attendance where records exist.
    const attByStudent = new Map<string, { present: number; total: number }>();
    try {
      const records = await prisma.attendance.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          date: { gte: exam.startDate, lte: exam.endDate },
        },
        select: { studentId: true, status: true },
      });
      for (const r of records) {
        const agg = attByStudent.get(r.studentId) ?? { present: 0, total: 0 };
        agg.total += 1;
        if (["PRESENT", "LATE", "HALF_DAY"].includes(r.status)) agg.present += 1;
        attByStudent.set(r.studentId, agg);
      }
    } catch {
      // Attendance is informational — never fail results over it.
    }
    for (const s of students) {
      const agg = attByStudent.get(s.id);
      (s as any).attendancePercentage = agg && agg.total ? Math.round((agg.present / agg.total) * 100) : null;
    }

    const totalStudents = students.length;
    const passedCount = students.filter((s) => s.passed).length;
    const avgPercentage = totalStudents > 0
      ? Math.round(students.reduce((sum, s) => sum + s.percentage, 0) / totalStudents)
      : 0;

    return {
      exam: {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        status: exam.status,
        rankEnabled,
      },
      students,
      summary: {
        totalStudents,
        passedCount,
        failedCount: totalStudents - passedCount,
        passRate: totalStudents > 0 ? Math.round((passedCount / totalStudents) * 100) : 0,
        avgPercentage,
      },
    };
  },

  /**
   * Bulk enter / update marks for one exam subject (saved as DRAFT).
   * Teachers may only enter marks for students in their assigned classes,
   * and only for DRAFT/REJECTED rows — SUBMITTED/APPROVED rows are locked
   * until a reviewer sends them back. After PUBLISHED, only holders of
   * exam.publish may correct marks, and every correction writes history.
   */
  async enterMarks(
    examId: string,
    auth: AuthUser,
    payload: {
      examSubjectId: string;
      marks: {
        studentId: string;
        marksObtained: number | null;
        remarks?: string;
        isAbsent?: boolean;
        isExempt?: boolean;
      }[];
    }
  ) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { subjects: { where: { id: payload.examSubjectId } } },
    });
    if (!exam) throw new NotFoundError("Exam");
    if (!auth.isSuperAdmin && auth.schoolId && exam.schoolId !== auth.schoolId) {
      throw new TenantError();
    }
    const isCorrection = exam.status === "PUBLISHED";
    if (isCorrection) {
      const perms = auth?.permissions || [];
      if (!auth.isSuperAdmin && !perms.includes("exam.publish")) {
        throw new ConflictError("Marks are locked — this exam is already published");
      }
    }
    const examSubject = exam.subjects[0];
    if (!examSubject) throw new NotFoundError("Exam subject for this exam");

    if (auth.roleName === "TEACHER") {
      const teacherId =
        auth.teacherId ||
        (
          await prisma.teacher.findFirst({
            where: { email: auth.email, schoolId: auth.schoolId || undefined },
            select: { id: true },
          })
        )?.id;
      if (!teacherId) throw new AuthorizationError("No linked teacher record");
      // Teacher must teach at least one of the students' classes (via timetable).
      const assigned = await prisma.timetable.findMany({
        where: { teacherId },
        select: { classId: true },
      });
      const allowedClasses = new Set(assigned.map((a) => a.classId));
      if (!allowedClasses.size) throw new AuthorizationError("No classes assigned to this teacher");
      const targets = await prisma.student.findMany({
        where: { id: { in: payload.marks.map((m) => m.studentId) } },
        select: { id: true, classId: true },
      });
      for (const t of targets) {
        if (!allowedClasses.has(t.classId)) {
          throw new AuthorizationError("Not assigned to this student's class");
        }
      }
      // Teachers cannot overwrite marks already in review — reviewers own those.
      const locked = await prisma.mark.findMany({
        where: {
          examSubjectId: payload.examSubjectId,
          studentId: { in: payload.marks.map((m) => m.studentId) },
          status: { in: ["SUBMITTED", "APPROVED"] },
        },
        select: { studentId: true },
      });
      if (locked.length && !isCorrection) {
        throw new ConflictError(`${locked.length} mark(s) are under review and cannot be edited`);
      }
    }

    const studentIds = payload.marks.map((m) => m.studentId);
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, schoolId: true },
    });
    const schoolOf = new Map(students.map((s) => [s.id, s.schoolId]));
    for (const m of payload.marks) {
      const sSchool = schoolOf.get(m.studentId);
      if (!sSchool) throw new NotFoundError(`Student ${m.studentId}`);
      if (sSchool !== exam.schoolId) {
        throw new TenantError("Student does not belong to this exam's school");
      }
      if (m.isAbsent && m.isExempt) {
        throw new ConflictError("A student cannot be both absent and exempted");
      }
      if (!m.isAbsent && !m.isExempt && m.marksObtained != null) {
        if (m.marksObtained < 0 || m.marksObtained > examSubject.maxMarks) {
          throw new ConflictError(`Marks must be between 0 and ${examSubject.maxMarks}`);
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const m of payload.marks) {
        const existing = await tx.mark.findUnique({
          where: {
            examSubjectId_studentId: {
              examSubjectId: payload.examSubjectId,
              studentId: m.studentId,
            },
          },
        });
        const data = {
          marksObtained: m.isAbsent || m.isExempt ? null : m.marksObtained,
          remarks: m.remarks,
          isAbsent: m.isAbsent ?? false,
          isExempt: m.isExempt ?? false,
          status: "DRAFT" as const,
        };
        let markId: string;
        if (!existing) {
          const created = await tx.mark.create({
            data: { examSubjectId: payload.examSubjectId, studentId: m.studentId, ...data },
          });
          markId = created.id;
        } else {
          await tx.mark.update({ where: { id: existing.id }, data });
          markId = existing.id;
          await tx.markHistory.create({
            data: {
              markId,
              examSubjectId: payload.examSubjectId,
              studentId: m.studentId,
              schoolId: exam.schoolId,
              oldMarks: existing.marksObtained,
              newMarks: data.marksObtained,
              oldStatus: existing.status as any,
              newStatus: "DRAFT",
              reason: isCorrection ? "Post-publication correction" : undefined,
              changedBy: auth.id,
            },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          userId: auth.id,
          action: "UPDATE",
          entity: "MARK",
          entityId: payload.examSubjectId,
          schoolId: exam.schoolId,
          newValue: { examId, count: payload.marks.length, correction: isCorrection },
        },
      });
    });

    return { success: true, updated: payload.marks.length };
  },

  /**
   * Submit entered marks for review (DRAFT/REJECTED -> SUBMITTED).
   * Teachers may submit only subjects they teach (timetable subject match
   * within the exam's scoped classes).
   */
  async submitMarks(examId: string, auth: AuthUser, examSubjectId: string, studentIds?: string[]) {
    const { examSubject } = await this.assertMarkAccess(examId, examSubjectId, auth, true);
    if (examSubject.exam.status === "PUBLISHED") {
      throw new ConflictError("Marks are locked — this exam is already published");
    }
    const where: any = { examSubjectId, status: { in: ["DRAFT", "REJECTED"] } };
    if (studentIds?.length) where.studentId = { in: studentIds };
    const rows = await prisma.mark.findMany({ where, select: { id: true } });
    if (!rows.length) return { success: true, submitted: 0 };
    await prisma.$transaction(async (tx) => {
      await tx.mark.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: "SUBMITTED", submittedAt: new Date() } });
      for (const r of rows) {
        await tx.markHistory.create({
          data: {
            markId: r.id, examSubjectId, studentId: (await tx.mark.findUnique({ where: { id: r.id }, select: { studentId: true } }))!.studentId,
            schoolId: examSubject.exam.schoolId, oldStatus: "DRAFT", newStatus: "SUBMITTED", changedBy: auth.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: auth.id, action: "UPDATE", entity: "MARK",
          entityId: examSubjectId, schoolId: examSubject.exam.schoolId,
          newValue: { examId, submitted: rows.length },
        },
      });
    });
    return { success: true, submitted: rows.length };
  },

  /**
   * Review submitted marks (SUBMITTED -> APPROVED or REJECTED + note).
   * Requires exam.edit (principal/admin) — teachers with only exam.marks
   * cannot approve their own entries.
   */
  async reviewMarks(
    examId: string,
    auth: AuthUser,
    examSubjectId: string,
    payload: { approved?: string[]; rejected?: { studentId: string; note?: string }[] }
  ) {
    const { examSubject } = await this.assertMarkAccess(examId, examSubjectId, auth, false);
    if (examSubject.exam.status === "PUBLISHED") {
      throw new ConflictError("Marks are locked — this exam is already published");
    }
    if (!auth.isSuperAdmin && !(auth.permissions || []).includes("exam.edit")) {
      throw new AuthorizationError("Reviewing marks requires exam.edit permission");
    }
    const now = new Date();
    let approved = 0;
    let rejected = 0;
    await prisma.$transaction(async (tx) => {
      if (payload.approved?.length) {
        const rows = await tx.mark.findMany({
          where: { examSubjectId, studentId: { in: payload.approved }, status: "SUBMITTED" },
        });
        for (const r of rows) {
          await tx.mark.update({ where: { id: r.id }, data: { status: "APPROVED", approvedBy: auth.id, approvedAt: now, reviewNote: null } });
          await tx.markHistory.create({
            data: {
              markId: r.id, examSubjectId, studentId: r.studentId, schoolId: examSubject.exam.schoolId,
              oldMarks: r.marksObtained, newMarks: r.marksObtained,
              oldStatus: "SUBMITTED", newStatus: "APPROVED", changedBy: auth.id,
            },
          });
          approved += 1;
        }
      }
      for (const rej of payload.rejected || []) {
        const r = await tx.mark.findFirst({ where: { examSubjectId, studentId: rej.studentId, status: "SUBMITTED" } });
        if (!r) continue;
        await tx.mark.update({ where: { id: r.id }, data: { status: "REJECTED", reviewNote: rej.note ?? null } });
        await tx.markHistory.create({
          data: {
            markId: r.id, examSubjectId, studentId: r.studentId, schoolId: examSubject.exam.schoolId,
            oldMarks: r.marksObtained, newMarks: r.marksObtained,
            oldStatus: "SUBMITTED", newStatus: "REJECTED", reason: rej.note, changedBy: auth.id,
          },
        });
        rejected += 1;
      }
      await tx.auditLog.create({
        data: {
          userId: auth.id, action: "APPROVE", entity: "MARK",
          entityId: examSubjectId, schoolId: examSubject.exam.schoolId,
          newValue: { examId, approved, rejected },
        },
      });
    });
    return { success: true, approved, rejected };
  },

  /** Marks roster for one exam subject: eligible students + marks + progress. */
  async getMarksRoster(examId: string, examSubjectId: string, auth: AuthUser) {
    const { examSubject } = await this.assertMarkAccess(examId, examSubjectId, auth, false);
    const or: any[] = [];
    for (const c of examSubject.exam.classes) {
      or.push(c.sectionId ? { classId: c.classId, sectionId: c.sectionId } : { classId: c.classId });
    }
    const studentWhere: any = { schoolId: examSubject.exam.schoolId, status: "ACTIVE" };
    if (or.length) studentWhere.OR = or;
    const [students, marks] = await Promise.all([
      prisma.student.findMany({
        where: studentWhere,
        orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
        select: {
          id: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
        take: 1000,
      }),
      prisma.mark.findMany({ where: { examSubjectId } }),
    ]);
    const byStudent = new Map(marks.map((m) => [m.studentId, m]));
    const rows = students.map((st) => ({ student: st, mark: byStudent.get(st.id) ?? null }));
    const entered = rows.filter((r) => r.mark && (r.mark.marksObtained != null || r.mark.isAbsent || r.mark.isExempt)).length;
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      const key = r.mark?.status ?? "NOT_ENTERED";
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }
    return {
      examSubject: {
        id: examSubject.id,
        maxMarks: examSubject.maxMarks,
        passMarks: examSubject.passMarks,
        subject: (examSubject as any).subject,
      },
      students: rows,
      progress: { total: rows.length, entered, byStatus },
    };
  },

  /** Exams scoped to the teacher's timetable subjects + classes, with entry progress. */
  async getTeacherExams(auth: AuthUser) {
    const teacherId =
      auth.teacherId ||
      (
        await prisma.teacher.findFirst({
          where: { email: auth.email, schoolId: auth.schoolId || undefined },
          select: { id: true },
        })
      )?.id;
    if (!teacherId) throw new AuthorizationError("No linked teacher record");
    const schoolId = auth.schoolId;
    if (!schoolId && !auth.isSuperAdmin) throw new TenantError("School context required");
    const entries = await prisma.timetable.findMany({ where: { teacherId } });
    const mySubjects = new Set(entries.map((e) => e.subjectId));
    const myClasses = new Set(entries.map((e) => e.classId));
    const owned = await prisma.schoolClass.findMany({ where: { classTeacherId: teacherId }, select: { id: true } });
    for (const c of owned) myClasses.add(c.id);
    const exams = await prisma.exam.findMany({
      where: { ...(schoolId ? { schoolId } : {}), status: { not: "ARCHIVED" } },
      include: {
        subjects: { include: { subject: { select: { id: true, name: true } } } },
        classes: { select: { classId: true, sectionId: true } },
      },
      orderBy: { startDate: "desc" },
      take: 100,
    });
    const result = [];
    for (const e of exams) {
      const inScope = e.classes.length === 0 || e.classes.some((c) => myClasses.has(c.classId));
      const mine = e.subjects.filter((s) => mySubjects.has(s.subjectId));
      if (!inScope || !mine.length) continue;
      const subjectIds = mine.map((s) => s.id);
      const [entered, submitted, approved] = await Promise.all([
        prisma.mark.count({ where: { examSubjectId: { in: subjectIds }, marksObtained: { not: null } } }),
        prisma.mark.count({ where: { examSubjectId: { in: subjectIds }, status: "SUBMITTED" } }),
        prisma.mark.count({ where: { examSubjectId: { in: subjectIds }, status: "APPROVED" } }),
      ]);
      const eligible = await prisma.student.count({
        where: {
          schoolId: e.schoolId, status: "ACTIVE",
          ...(e.classes.length
            ? { OR: e.classes.map((c) => (c.sectionId ? { classId: c.classId, sectionId: c.sectionId } : { classId: c.classId })) }
            : {}),
        },
      });
      result.push({
        ...e,
        mySubjects: mine,
        progress: { eligible: eligible * mine.length, entered, submitted, approved },
      });
    }
    return result;
  },

  /** Shared gate for mark mutation flows. Teacher subject scoping optional. */
  async assertMarkAccess(examId: string, examSubjectId: string, auth: AuthUser, requireSubjectTaught: boolean) {
    const examSubject = await prisma.examSubject.findUnique({
      where: { id: examSubjectId },
      include: {
        exam: { include: { classes: true } },
        subject: { select: { id: true, name: true } },
      },
    });
    if (!examSubject || examSubject.examId !== examId) throw new NotFoundError("Exam subject for this exam");
    if (!auth.isSuperAdmin && auth.schoolId && examSubject.exam.schoolId !== auth.schoolId) {
      throw new TenantError();
    }
    if (auth.roleName === "TEACHER" && requireSubjectTaught) {
      const teacherId =
        auth.teacherId ||
        (
          await prisma.teacher.findFirst({
            where: { email: auth.email, schoolId: auth.schoolId || undefined },
            select: { id: true },
          })
        )?.id;
      if (!teacherId) throw new AuthorizationError("No linked teacher record");
      const entries = await prisma.timetable.findMany({ where: { teacherId } });
      const teachesSubject = entries.some((e) => e.subjectId === examSubject.subjectId);
      if (!teachesSubject) throw new AuthorizationError("Not assigned to this subject");
      const myClasses = new Set(entries.map((e) => e.classId));
      const owned = await prisma.schoolClass.findMany({ where: { classTeacherId: teacherId }, select: { id: true } });
      for (const c of owned) myClasses.add(c.id);
      const examClasses = examSubject.exam.classes.map((c) => c.classId);
      const overlaps = examClasses.length === 0 || examClasses.some((c) => myClasses.has(c));
      if (!overlaps) throw new AuthorizationError("Not assigned to this exam's classes");
    }
    return { examSubject };
  },

  /* ---------------- Exam timetable ---------------- */

  /**
   * Detect overlapping exams: same class (via ExamClass scope), same room,
   * or same invigilator on the same date with overlapping times.
   */
  async detectTimetableConflicts(
    examId: string,
    entry: { subjectId?: string; date?: string; startTime?: string; endTime?: string; room?: string; invigilatorId?: string },
    ignoreExamSubjectId?: string
  ) {
    const conflicts: { type: string; message: string }[] = [];
    if (!entry.date || !entry.startTime || !entry.endTime) return conflicts;
    const start = toMinutes(entry.startTime);
    const end = toMinutes(entry.endTime);
    if (start == null || end == null || end <= start) {
      conflicts.push({ type: "INVALID_TIME", message: "End time must be after start time (HH:MM)" });
      return conflicts;
    }
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { schoolId: true, classes: { select: { classId: true, sectionId: true } } },
    });
    if (!exam) throw new NotFoundError("Exam");
    const dayStart = new Date(entry.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(entry.date);
    dayEnd.setHours(23, 59, 59, 999);
    const others = await prisma.examSubject.findMany({
      where: {
        exam: { schoolId: exam.schoolId },
        date: { gte: dayStart, lte: dayEnd },
        ...(ignoreExamSubjectId ? { id: { not: ignoreExamSubjectId } } : {}),
      },
      include: {
        subject: { select: { name: true } },
        exam: { select: { id: true, name: true, classes: { select: { classId: true, sectionId: true } } } },
      },
    });
    const overlaps = (s: string | null, e: string | null) => {
      if (!s || !e) return false;
      const a = toMinutes(s);
      const b = toMinutes(e);
      if (a == null || b == null) return false;
      return start < b && a < end;
    };
    const scopeOverlaps = (
      a: { classId: string; sectionId: string | null }[],
      b: { classId: string; sectionId: string | null }[]
    ) => {
      if (!a.length || !b.length) return true; // unscoped legacy exam: assume shared students
      return a.some((x) => b.some((y) => x.classId === y.classId && (!x.sectionId || !y.sectionId || x.sectionId === y.sectionId)));
    };
    for (const o of others) {
      if (!overlaps(o.startTime, o.endTime)) continue;
      const label = `${o.exam.name} · ${o.subject.name} (${o.startTime}–${o.endTime})`;
      if (scopeOverlaps(exam.classes, o.exam.classes as any)) {
        conflicts.push({ type: "CLASS_OVERLAP", message: `Overlaps ${label} for the same class` });
      }
      if (entry.room && o.room && entry.room.trim().toLowerCase() === o.room.trim().toLowerCase()) {
        conflicts.push({ type: "ROOM_OVERLAP", message: `Room ${entry.room} is already booked by ${label}` });
      }
      if (entry.invigilatorId && o.invigilatorId && entry.invigilatorId === o.invigilatorId) {
        conflicts.push({ type: "INVIGILATOR_OVERLAP", message: `Invigilator is already assigned to ${label}` });
      }
    }
    return conflicts;
  },

  async addExamSubject(examId: string, auth: AuthUser, data: {
    subjectId: string; maxMarks: number; passMarks: number; date?: string;
    startTime?: string; endTime?: string; durationMin?: number; room?: string;
    invigilatorId?: string; instructions?: string;
  }) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundError("Exam");
    if (!auth.isSuperAdmin && auth.schoolId && exam.schoolId !== auth.schoolId) throw new TenantError();
    if (exam.status === "PUBLISHED" || exam.status === "ARCHIVED") {
      throw new ConflictError(`Cannot change the timetable of a ${exam.status} exam`);
    }
    const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject || (subject as any).schoolId !== exam.schoolId) throw new NotFoundError("Subject");
    if (data.passMarks > data.maxMarks) throw new ConflictError("Passing marks cannot exceed maximum marks");
    if (data.invigilatorId) {
      const inv = await prisma.teacher.findUnique({ where: { id: data.invigilatorId } });
      if (!inv || inv.schoolId !== exam.schoolId) throw new NotFoundError("Invigilator");
    }
    const conflicts = await this.detectTimetableConflicts(examId, data);
    if (conflicts.length) {
      throw new ConflictError(conflicts.map((c) => c.message).join("; "));
    }
    const created = await prisma.examSubject.create({
      data: {
        examId,
        subjectId: data.subjectId,
        maxMarks: data.maxMarks,
        passMarks: data.passMarks,
        date: data.date ? new Date(data.date) : null,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMin: data.durationMin ?? null,
        room: data.room ?? null,
        invigilatorId: data.invigilatorId ?? null,
        instructions: data.instructions ?? null,
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "EXAM_TIMETABLE",
        entityId: created.id, schoolId: exam.schoolId, newValue: { examId, subjectId: data.subjectId },
      },
    });
    if (exam.status === "SCHEDULED") await this.notifyTimetableChanged(examId, "updated");
    return created;
  },

  async updateExamSubject(examId: string, examSubjectId: string, auth: AuthUser, data: {
    maxMarks?: number; passMarks?: number; date?: string | null;
    startTime?: string | null; endTime?: string | null; durationMin?: number | null;
    room?: string | null; invigilatorId?: string | null; instructions?: string | null;
  }) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundError("Exam");
    if (!auth.isSuperAdmin && auth.schoolId && exam.schoolId !== auth.schoolId) throw new TenantError();
    if (exam.status === "PUBLISHED" || exam.status === "ARCHIVED") {
      throw new ConflictError(`Cannot change the timetable of a ${exam.status} exam`);
    }
    const es = await prisma.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!es || es.examId !== examId) throw new NotFoundError("Exam timetable entry");
    const next = {
      date: data.date !== undefined ? (data.date ? new Date(data.date).toISOString() : null) : (es.date ? es.date.toISOString() : null),
      startTime: data.startTime !== undefined ? data.startTime : es.startTime,
      endTime: data.endTime !== undefined ? data.endTime : es.endTime,
      room: data.room !== undefined ? data.room : es.room,
      invigilatorId: data.invigilatorId !== undefined ? data.invigilatorId : es.invigilatorId,
    };
    const conflicts = await this.detectTimetableConflicts(
      examId,
      { date: next.date ?? undefined, startTime: next.startTime ?? undefined, endTime: next.endTime ?? undefined, room: next.room ?? undefined, invigilatorId: next.invigilatorId ?? undefined },
      examSubjectId
    );
    if (conflicts.length) {
      throw new ConflictError(conflicts.map((c) => c.message).join("; "));
    }
    const maxMarks = data.maxMarks ?? es.maxMarks;
    const passMarks = data.passMarks ?? es.passMarks;
    if (passMarks > maxMarks) throw new ConflictError("Passing marks cannot exceed maximum marks");
    const updated = await prisma.examSubject.update({
      where: { id: examSubjectId },
      data: {
        maxMarks,
        passMarks,
        date: data.date !== undefined ? (data.date ? new Date(data.date) : null) : undefined,
        startTime: data.startTime !== undefined ? data.startTime : undefined,
        endTime: data.endTime !== undefined ? data.endTime : undefined,
        durationMin: data.durationMin !== undefined ? data.durationMin : undefined,
        room: data.room !== undefined ? data.room : undefined,
        invigilatorId: data.invigilatorId !== undefined ? data.invigilatorId : undefined,
        instructions: data.instructions !== undefined ? data.instructions : undefined,
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "UPDATE", entity: "EXAM_TIMETABLE",
        entityId: examSubjectId, schoolId: exam.schoolId, newValue: data as any,
      },
    });
    if (exam.status === "SCHEDULED") await this.notifyTimetableChanged(examId, "rescheduled");
    return updated;
  },

  async deleteExamSubject(examId: string, examSubjectId: string, auth: AuthUser) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundError("Exam");
    if (!auth.isSuperAdmin && auth.schoolId && exam.schoolId !== auth.schoolId) throw new TenantError();
    if (exam.status === "PUBLISHED" || exam.status === "ARCHIVED") {
      throw new ConflictError(`Cannot change the timetable of a ${exam.status} exam`);
    }
    const es = await prisma.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!es || es.examId !== examId) throw new NotFoundError("Exam timetable entry");
    const markCount = await prisma.mark.count({ where: { examSubjectId } });
    if (markCount > 0) {
      throw new ConflictError("Cannot remove a subject with recorded marks");
    }
    await prisma.examSubject.delete({ where: { id: examSubjectId } });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "DELETE", entity: "EXAM_TIMETABLE",
        entityId: examSubjectId, schoolId: exam.schoolId,
      },
    });
    return { success: true };
  },

  async notifyTimetableChanged(examId: string, kind: "updated" | "rescheduled" | "cancelled" = "updated") {
    const { userIds, schoolId, examName } = await examStudentUserIds(examId);
    const word = kind === "cancelled" ? "cancelled" : kind === "rescheduled" ? "rescheduled" : "updated";
    await notifyExamUsers(
      userIds, schoolId,
      `Timetable ${word}: ${examName}`,
      `The ${examName} timetable was ${word}. Please check the latest schedule.`,
      `exam:${examId}`
    );
  },

  /* ---------------- Report card ---------------- */

  async getReportCard(examId: string, studentId: string, auth: AuthUser) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        subjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            marks: { where: { studentId } },
          },
          orderBy: { date: "asc" },
        },
        classes: true,
      },
    });
    if (!exam) throw new NotFoundError("Exam");
    const schoolId = auth.isSuperAdmin ? exam.schoolId : auth.schoolId || undefined;
    if (schoolId && exam.schoolId !== schoolId) throw new TenantError();
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        school: { select: { id: true, name: true, schoolCode: true } },
      },
    });
    if (!student || student.schoolId !== exam.schoolId) throw new NotFoundError("Student");
    if (auth.roleName === "STUDENT") {
      const { resolveStudentId } = await import("./academicsService");
      const ownId = await resolveStudentId(auth);
      if (ownId !== studentId) throw new AuthorizationError("You can only view your own report card");
      if (exam.status !== "PUBLISHED") throw new AuthorizationError("Results are not published yet");
    } else if (auth.roleName === "PARENT") {
      await this.assertParentChild(auth, studentId);
      if (exam.status !== "PUBLISHED") throw new AuthorizationError("Results are not published yet");
    }
    // Exam must apply to this student's class/section.
    if (exam.classes.length > 0) {
      const applies = exam.classes.some(
        (c) => c.classId === student.classId && (!c.sectionId || c.sectionId === student.sectionId)
      );
      if (!applies) throw new AuthorizationError("This exam does not apply to the student");
    }
    const policy = (exam.gradingPolicy as any) || {};
    const boundaries = { ...DEFAULT_GRADE_BOUNDARIES, ...(policy.boundaries || {}) };
    let totalObtained = 0;
    let totalMax = 0;
    let passed = true;
    const subjects = exam.subjects.map((es) => {
      const mark = es.marks[0];
      const isExempt = mark?.isExempt === true;
      const isAbsent = mark?.isAbsent === true;
      const obtained = isExempt ? null : isAbsent ? 0 : mark?.marksObtained ?? null;
      if (!isExempt) {
        totalMax += es.maxMarks;
        totalObtained += obtained ?? 0;
        if (isAbsent || (obtained ?? 0) < es.passMarks) passed = false;
      }
      const pct = !isExempt && es.maxMarks > 0 ? Math.round(((obtained ?? 0) / es.maxMarks) * 100) : null;
      return {
        subject: es.subject,
        maxMarks: es.maxMarks,
        passMarks: es.passMarks,
        obtained,
        percentage: pct,
        grade: pct == null ? null : gradeFor(pct, boundaries),
        isAbsent,
        isExempt,
        remarks: mark?.remarks ?? null,
      };
    });
    const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
    // Rank among classmates when enabled.
    let rank: number | null = null;
    if (policy.rankEnabled === true) {
      const results = await this.getResults(examId, exam.schoolId, true);
      const row = results.students.find((s) => s.id === studentId);
      rank = (row as any)?.rank ?? null;
    }
    let attendancePercentage: number | null = null;
    try {
      const records = await prisma.attendance.findMany({
        where: { studentId, date: { gte: exam.startDate, lte: exam.endDate } },
        select: { status: true },
      });
      if (records.length) {
        const present = records.filter((r) => ["PRESENT", "LATE", "HALF_DAY"].includes(r.status)).length;
        attendancePercentage = Math.round((present / records.length) * 100);
      }
    } catch { /* informational only */ }
    return {
      exam: {
        id: exam.id, name: exam.name, type: exam.type, status: exam.status,
        startDate: exam.startDate, endDate: exam.endDate, instructions: exam.instructions,
      },
      student: {
        id: student.id, firstName: student.firstName, lastName: student.lastName,
        admissionNumber: student.admissionNumber, rollNumber: student.rollNumber,
        class: student.class, section: student.section, school: student.school,
      },
      subjects,
      totalObtained,
      totalMax,
      percentage,
      grade: gradeFor(percentage, boundaries),
      passed,
      rank,
      attendancePercentage,
    };
  },

  async getReportSchool(report: { student: { school: { id: string } } }) {
    const school = await prisma.school.findUnique({ where: { id: report.student.school.id } });
    if (!school) throw new NotFoundError("School");
    return school;
  },

  /* ---------------- Scoped feeds ---------------- */

  async assertParentChild(auth: AuthUser, studentId: string) {
    const parent =
      (auth as any).parentId
        ? await prisma.parent.findUnique({ where: { id: (auth as any).parentId } })
        : await prisma.parent.findFirst({
            where: { userId: auth.id },
          });
    const byEmail = parent
      ? parent
      : await prisma.parent.findFirst({
          where: { email: auth.email, schoolId: auth.schoolId || undefined },
        });
    if (!byEmail) throw new AuthorizationError("No linked parent record");
    const link = await prisma.studentParent.findFirst({
      where: { studentId, parentId: byEmail.id },
    });
    if (!link) throw new AuthorizationError("Not linked to this student");
    return byEmail;
  },

  async getLinkedChildren(auth: AuthUser) {
    const parent =
      (auth as any).parentId
        ? await prisma.parent.findUnique({ where: { id: (auth as any).parentId } })
        : (await prisma.parent.findFirst({ where: { userId: auth.id } })) ||
          (await prisma.parent.findFirst({ where: { email: auth.email, schoolId: auth.schoolId || undefined } }));
    if (!parent) throw new AuthorizationError("No linked parent record");
    return prisma.student.findMany({
      where: { parents: { some: { parentId: parent.id } } },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
  },

  /** Exams applicable to a student's own class/section (family-visible statuses only). */
  async getStudentExams(auth: AuthUser) {
    const { resolveStudentId } = await import("./academicsService");
    const studentId = await resolveStudentId(auth);
    if (!studentId) throw new NotFoundError("Linked student record");
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError("Linked student record");
    const tz = await getSchoolTimezone(student.schoolId);
    const exams = await prisma.exam.findMany({
      where: {
        schoolId: student.schoolId,
        status: { in: ["SCHEDULED", "IN_PROGRESS", "PUBLISHED"] },
        OR: [
          { classes: { none: {} } },
          {
            classes: {
              some: {
                classId: student.classId,
                OR: [{ sectionId: null }, ...(student.sectionId ? [{ sectionId: student.sectionId }] : [])],
              },
            },
          },
        ],
      },
      include: {
        subjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            invigilator: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { startDate: "asc" },
      take: 100,
    });
    const now = new Date();
    return exams.map((e) => {
      const start = new Date(e.startDate).getTime();
      const end = new Date(e.endDate).getTime();
      const bucket = e.status === "PUBLISHED" ? "RESULTS_PUBLISHED" : end < now.getTime() ? "COMPLETED" : start <= now.getTime() && now.getTime() <= end ? "TODAY" : start > now.getTime() ? "UPCOMING" : "COMPLETED";
      return {
        ...e,
        bucket,
        timezone: tz,
        subjectCount: e.subjects.length,
        startLocal: formatInTimezone(e.startDate, tz),
        endLocal: formatInTimezone(e.endDate, tz),
      };
    });
  },
};


