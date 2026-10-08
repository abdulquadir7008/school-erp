import { prisma } from "../config/database";
import { ConflictError, NotFoundError, TenantError } from "../utils/errors";

interface CreateSubjectData {
  name: string;
  code: string;
  schoolId: string;
  departmentId?: string;
}

export const subjectService = {
  async create(data: CreateSubjectData) {
    const existing = await prisma.subject.findUnique({
      where: {
        schoolId_code: {
          schoolId: data.schoolId,
          code: data.code.toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictError("Subject code already exists in this school");
    }

    const subject = await prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({
        data: {
          name: data.name,
          code: data.code.toUpperCase(),
          schoolId: data.schoolId,
          departmentId: data.departmentId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "SUBJECT",
          entityId: created.id,
          schoolId: data.schoolId,
          newValue: { name: created.name, code: created.code },
        },
      });

      return created;
    });

    return subject;
  },

  async getById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const subject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      throw new NotFoundError("Subject");
    }

    if (!isSuperAdmin && subject.schoolId !== schoolId) {
      throw new TenantError();
    }

    return subject;
  },

  async update(
    id: string,
    schoolId: string | undefined,
    data: Partial<CreateSubjectData>,
    isSuperAdmin = false
  ) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundError("Subject");
    }
    if (!isSuperAdmin && subject.schoolId !== schoolId) {
      throw new TenantError();
    }

    return prisma.$transaction(async (tx) => {
      if (data.code) {
        const existing = await tx.subject.findFirst({
          where: {
            schoolId: subject.schoolId,
            code: data.code.toUpperCase(),
            id: { not: id },
          },
        });
        if (existing) {
          throw new ConflictError("Subject code already exists in this school");
        }
      }

      const updated = await tx.subject.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code ? data.code.toUpperCase() : undefined,
          departmentId: data.departmentId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "SUBJECT",
          entityId: subject.id,
          schoolId: subject.schoolId,
          oldValue: { name: subject.name, code: subject.code },
          newValue: { name: data.name, code: data.code },
        },
      });

      return updated;
    });
  },

  async delete(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundError("Subject");
    }
    if (!isSuperAdmin && subject.schoolId !== schoolId) {
      throw new TenantError();
    }

    await prisma.$transaction(async (tx) => {
      await tx.examSubject.deleteMany({ where: { subjectId: subject.id } });
      await tx.timetable.deleteMany({ where: { subjectId: subject.id } });

      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "SUBJECT",
          entityId: subject.id,
          schoolId: subject.schoolId,
          oldValue: { name: subject.name, code: subject.code },
        },
      });

      await tx.subject.delete({ where: { id: subject.id } });
    });

    return { success: true };
  },

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
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
        { code: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [total, subjects] = await Promise.all([
      prisma.subject.count({ where }),
      prisma.subject.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          _count: { select: { timetableEntries: true, assignments: true } },
        },
      }),
    ]);

    return {
      data: subjects,
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

    const [subjects, classes, sectionsCount] = await Promise.all([
      prisma.subject.count({ where: scope }),
      prisma.schoolClass.count({ where: scope }),
      prisma.section.count({ where: schoolId ? { class: { schoolId } } : {} }),
    ]);

    return { subjects, classes, sections: sectionsCount };
  },
};