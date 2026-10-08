import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import { ConflictError, NotFoundError, TenantError } from "../utils/errors";

interface CreateTeacherData {
  employeeId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  qualification?: string;
  specialization?: string;
  joiningDate?: string;
  status?: string;
  schoolId: string;
  branchId?: string;
}

export const teacherService = {
  async create(data: CreateTeacherData) {
    const existing = await prisma.teacher.findUnique({
      where: {
        schoolId_employeeId: {
          schoolId: data.schoolId,
          employeeId: data.employeeId.toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictError("Employee ID already in use");
    }

    const teacher = await prisma.$transaction(async (tx) => {
      const created = await tx.teacher.create({
        data: {
          employeeId: data.employeeId.toUpperCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          qualification: data.qualification,
          specialization: data.specialization,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
          branchId: data.branchId || null,
          schoolId: data.schoolId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "TEACHER",
          entityId: created.id,
          schoolId: data.schoolId,
          newValue: { employeeId: created.employeeId, firstName: created.firstName },
        },
      });

      return created;
    });

    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: { email: data.email.toLowerCase(), schoolId: data.schoolId },
      });

      if (!existingUser) {
        const teacherRole = await prisma.role.findUnique({
          where: { name: "TEACHER" },
        });

        if (teacherRole) {
          await prisma.user.create({
            data: {
              email: data.email.toLowerCase(),
              passwordHash: await bcrypt.hash("School@2024", 10),
              firstName: data.firstName,
              lastName: data.lastName,
              roleId: teacherRole.id,
              schoolId: data.schoolId,
            },
          });
        }
      }
    }

    return teacher;
  },

  async getById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        school: { select: { id: true, name: true } },
      },
    });

    if (!teacher) {
      throw new NotFoundError("Teacher");
    }

    if (!isSuperAdmin && teacher.schoolId !== schoolId) {
      throw new TenantError();
    }

    return teacher;
  },

  async update(
    id: string,
    schoolId: string | undefined,
    data: Partial<CreateTeacherData>,
    isSuperAdmin = false
  ) {
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) {
      throw new NotFoundError("Teacher");
    }
    if (!isSuperAdmin && teacher.schoolId !== schoolId) {
      throw new TenantError();
    }

    return prisma.$transaction(async (tx) => {
      if (data.employeeId) {
        const existing = await tx.teacher.findFirst({
          where: {
            schoolId: teacher.schoolId,
            employeeId: data.employeeId.toUpperCase(),
            id: { not: id },
          },
        });
        if (existing) {
          throw new ConflictError("Employee ID already in use");
        }
      }

      const updated = await tx.teacher.update({
        where: { id },
        data: {
          employeeId: data.employeeId ? data.employeeId.toUpperCase() : undefined,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          qualification: data.qualification,
          specialization: data.specialization,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
          status: data.status,
          branchId: data.branchId,
        },
        include: {
          branch: { select: { id: true, name: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "TEACHER",
          entityId: teacher.id,
          schoolId: teacher.schoolId,
          oldValue: { firstName: teacher.firstName, employeeId: teacher.employeeId },
          newValue: { firstName: data.firstName, employeeId: data.employeeId },
        },
      });

      return updated;
    });
  },

  async delete(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) {
      throw new NotFoundError("Teacher");
    }
    if (!isSuperAdmin && teacher.schoolId !== schoolId) {
      throw new TenantError();
    }

    await prisma.$transaction(async (tx) => {
      await tx.timetable.deleteMany({ where: { teacherId: teacher.id } });

      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "TEACHER",
          entityId: teacher.id,
          schoolId: teacher.schoolId,
          oldValue: { firstName: teacher.firstName, employeeId: teacher.employeeId },
        },
      });

      await tx.teacher.delete({ where: { id: teacher.id } });
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
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { employeeId: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { specialization: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [total, teachers] = await Promise.all([
      prisma.teacher.count({ where }),
      prisma.teacher.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          branch: { select: { id: true, name: true } },
          school: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      data: teachers,
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

    const [total, active, onLeave] = await Promise.all([
      prisma.teacher.count({ where: scope }),
      prisma.teacher.count({ where: { ...scope, status: "ACTIVE" } }),
      prisma.teacher.count({ where: { ...scope, status: "ON_LEAVE" } }),
    ]);

    return { total, active, onLeave };
  },
};