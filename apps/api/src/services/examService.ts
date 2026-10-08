import { prisma } from "../config/database";
import { NotFoundError, TenantError } from "../utils/errors";

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

  async getById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
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
    isSuperAdmin = false
  ) {
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundError("Exam");
    }
    if (!isSuperAdmin && schoolId && exam.schoolId !== schoolId) {
      throw new TenantError();
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

    if (query.status) {
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
    isSuperAdmin = false
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
