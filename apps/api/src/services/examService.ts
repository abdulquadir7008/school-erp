import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  TenantError,
} from "../utils/errors";

interface CreateExamData {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  schoolId: string;
  academicYearId?: string;
  subjects: {
    subjectId: string;
    maxMarks: number;
    passMarks: number;
    date?: string;
    startTime?: string;
    endTime?: string;
  }[];
}

export const examService = {
  async create(data: CreateExamData) {
    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          name: data.name,
          type: data.type,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          schoolId: data.schoolId,
          academicYearId: data.academicYearId,
          status: "DRAFT",
        },
      });

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
          },
          orderBy: { date: "asc" },
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

    return prisma.$transaction(async (tx) => {
      const updated = await tx.exam.update({
        where: { id },
        data: {
          name: data.name,
          type: data.type,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
      });

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

    // Publishing is privileged: require exam.publish (teachers hold
    // exam.marks only, so they can enter marks but never publish).
    if (status === "PUBLISHED" && !isSuperAdmin) {
      const perms = auth?.permissions || [];
      if (!perms.includes("exam.publish")) {
        throw new AuthorizationError("Publishing results requires exam.publish permission");
      }
    }

    return prisma.exam.update({
      where: { id },
      data: { status: status as any },
    });
  },

  async delete(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundError("Exam");
    }
    if (!isSuperAdmin && schoolId && exam.schoolId !== schoolId) {
      throw new TenantError();
    }

    await prisma.$transaction(async (tx) => {
      await tx.mark.deleteMany({
        where: { examSubject: { examId: id } },
      });
      await tx.examSubject.deleteMany({ where: { examId: id } });

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

    const [total, scheduled, inProgress, completed, published] = await Promise.all([
      prisma.exam.count({ where: scope }),
      prisma.exam.count({ where: { ...scope, status: "SCHEDULED" } }),
      prisma.exam.count({ where: { ...scope, status: "IN_PROGRESS" } }),
      prisma.exam.count({ where: { ...scope, status: "COMPLETED" } }),
      prisma.exam.count({ where: { ...scope, status: "PUBLISHED" } }),
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
        subjects: {
          name: string;
          obtained: number | null;
          maxMarks: number;
          passMarks: number;
          passed: boolean;
          remarks: string | null;
        }[];
      }
    >();

    for (const es of exam.subjects) {
      for (const mark of es.marks) {
        const sid = mark.student.id;
        if (!studentMap.has(sid)) {
          studentMap.set(sid, {
            id: sid,
            firstName: mark.student.firstName,
            lastName: mark.student.lastName,
            admissionNumber: mark.student.admissionNumber,
            totalMarks: 0,
            totalObtained: 0,
            totalMax: 0,
            totalPass: 0,
            passed: true,
            subjects: [],
          });
        }
        const s = studentMap.get(sid)!;
        s.totalObtained += mark.marksObtained || 0;
        s.totalMax += es.maxMarks;
        s.totalPass += es.passMarks;
        s.subjects.push({
          name: es.subject.name,
          obtained: mark.marksObtained,
          maxMarks: es.maxMarks,
          passMarks: es.passMarks,
          passed: (mark.marksObtained || 0) >= es.passMarks,
          remarks: mark.remarks,
        });
        if ((mark.marksObtained || 0) < es.passMarks) {
          s.passed = false;
        }
      }
    }

    const students = Array.from(studentMap.values()).map((s) => ({
      ...s,
      percentage: s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 0,
      grade: getGrade(s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 0),
    }));

    students.sort((a, b) => b.percentage - a.percentage);

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
   * Bulk enter / update marks for one exam subject.
   * Allowed while the exam is DRAFT / SCHEDULED / IN_PROGRESS / COMPLETED —
   * NEVER after PUBLISHED. Teachers may only submit marks for students in
   * their own school (and, when the caller is a TEACHER, the per-student
   * school check below is the enforcement point — IDs from the client are
   * never trusted).
   */
  async enterMarks(
    examId: string,
    auth: AuthUser,
    payload: {
      examSubjectId: string;
      marks: { studentId: string; marksObtained: number | null; remarks?: string }[];
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
    if (exam.status === "PUBLISHED") {
      throw new ConflictError("Marks are locked — this exam is already published");
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
      if (
        m.marksObtained != null &&
        (m.marksObtained < 0 || m.marksObtained > examSubject.maxMarks)
      ) {
        throw new ConflictError(
          `Marks must be between 0 and ${examSubject.maxMarks}`
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const m of payload.marks) {
        await tx.mark.upsert({
          where: {
            examSubjectId_studentId: {
              examSubjectId: payload.examSubjectId,
              studentId: m.studentId,
            },
          },
          create: {
            examSubjectId: payload.examSubjectId,
            studentId: m.studentId,
            marksObtained: m.marksObtained,
            remarks: m.remarks,
          },
          update: {
            marksObtained: m.marksObtained,
            remarks: m.remarks,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: auth.id,
          action: "UPDATE",
          entity: "MARK",
          entityId: payload.examSubjectId,
          schoolId: exam.schoolId,
          newValue: { examId, count: payload.marks.length },
        },
      });
    });

    return { success: true, updated: payload.marks.length };
  },
};

function getGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}
