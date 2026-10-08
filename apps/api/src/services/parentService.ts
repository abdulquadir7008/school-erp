import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import { NotFoundError, TenantError } from "../utils/errors";

interface CreateParentData {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  occupation?: string;
  schoolId: string;
  studentId?: string;
  relation?: string;
}

export const parentService = {
  async create(data: CreateParentData) {
    return prisma.$transaction(async (tx) => {
      if (data.studentId) {
        const student = await tx.student.findUnique({
          where: { id: data.studentId },
          select: { schoolId: true },
        });
        if (!student) {
          throw new NotFoundError("Student");
        }
        if (student.schoolId !== data.schoolId) {
          throw new TenantError("Student does not belong to this school");
        }
      }

      const parent = await tx.parent.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          occupation: data.occupation,
          schoolId: data.schoolId,
        },
      });

      if (data.studentId) {
        await tx.studentParent.create({
          data: {
            studentId: data.studentId,
            parentId: parent.id,
            relation: data.relation || "PARENT",
          },
        });
      }

      if (data.email) {
        const existingUser = await tx.user.findFirst({
          where: { email: data.email.toLowerCase(), schoolId: data.schoolId },
        });

        if (existingUser) {
          return existingUser;
        }

        const parentRole = await tx.role.findUnique({
          where: { name: "PARENT" },
        });

        if (parentRole) {
          await tx.user.create({
            data: {
              email: data.email.toLowerCase(),
              passwordHash: await bcrypt.hash("School@2024", 10),
              firstName: data.firstName,
              lastName: data.lastName,
              roleId: parentRole.id,
              schoolId: data.schoolId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "PARENT",
          entityId: parent.id,
          schoolId: data.schoolId,
          newValue: { firstName: parent.firstName, lastName: parent.lastName },
        },
      });

      return parent;
    });
  },

  async update(
    id: string,
    schoolId: string | undefined,
    data: Partial<CreateParentData>,
    isSuperAdmin = false
  ) {
    const parent = await prisma.parent.findUnique({ where: { id } });
    if (!parent) {
      throw new NotFoundError("Parent");
    }
    if (!isSuperAdmin && parent.schoolId !== schoolId) {
      throw new TenantError();
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.parent.update({
        where: { id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          occupation: data.occupation,
        },
        include: {
          students: {
            include: {
              student: {
                select: { id: true, firstName: true, lastName: true, admissionNumber: true },
              },
            },
          },
        },
      });

      const targetSchoolId = isSuperAdmin && data.schoolId ? data.schoolId : parent.schoolId;

      if (data.studentId) {
        const student = await tx.student.findUnique({
          where: { id: data.studentId },
          select: { schoolId: true },
        });
        if (!student) {
          throw new NotFoundError("Student");
        }
        if (student.schoolId !== targetSchoolId) {
          throw new TenantError("Student does not belong to this school");
        }

        await tx.studentParent.deleteMany({ where: { parentId: parent.id } });
        await tx.studentParent.create({
          data: {
            studentId: data.studentId,
            parentId: parent.id,
            relation: data.relation || "PARENT",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "PARENT",
          entityId: parent.id,
          schoolId: targetSchoolId,
          oldValue: { firstName: parent.firstName, lastName: parent.lastName },
          newValue: { firstName: data.firstName, lastName: data.lastName },
        },
      });

      return updated;
    });
  },

  async delete(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const parent = await prisma.parent.findUnique({ where: { id } });
    if (!parent) {
      throw new NotFoundError("Parent");
    }
    if (!isSuperAdmin && parent.schoolId !== schoolId) {
      throw new TenantError();
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentParent.deleteMany({ where: { parentId: parent.id } });
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "PARENT",
          entityId: parent.id,
          schoolId: parent.schoolId,
          oldValue: { firstName: parent.firstName, lastName: parent.lastName },
        },
      });
      await tx.parent.delete({ where: { id } });
    });

    return { success: true };
  },

  async getById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const parent = await prisma.parent.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true } },
        students: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundError("Parent");
    }

    if (!isSuperAdmin && parent.schoolId !== schoolId) {
      throw new TenantError();
    }

    return parent;
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
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [total, parents] = await Promise.all([
      prisma.parent.count({ where }),
      prisma.parent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  admissionNumber: true,
                  class: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: parents,
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

    const total = await prisma.parent.count({ where: scope });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newThisMonth = await prisma.parent.count({
      where: { ...scope, createdAt: { gte: thirtyDaysAgo } },
    });

    return { total, newThisMonth };
  },
};
