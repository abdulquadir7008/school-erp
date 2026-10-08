import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import {
  ConflictError,
  NotFoundError,
  TenantError,
} from "../utils/errors";

export const userService = {
  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    schoolId?: string;
    roleName?: string;
    isSuperAdmin: boolean;
    requesterSchoolId?: string;
    requesterRole?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));

    const where: any = {};

    if (query.isSuperAdmin) {
      if (query.schoolId) {
        where.schoolId = query.schoolId;
      }
    } else {
      if (query.requesterRole === "SCHOOL_ADMIN" && query.requesterSchoolId) {
        where.schoolId = query.requesterSchoolId;
      } else if (query.requesterRole !== "SUPER_ADMIN") {
        throw new TenantError();
      }
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: "insensitive" } },
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.roleName) {
      where.role = { name: query.roleName };
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { name: true, description: true } },
          school: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    roleName: string;
    schoolId: string;
    branchId?: string;
  }) {
    const role = await prisma.role.findUnique({
      where: { name: data.roleName },
    });

    if (!role) {
      throw new NotFoundError("Role");
    }

    const existing = await prisma.user.findFirst({
      where: { email: data.email, schoolId: data.schoolId },
    });

    if (existing) {
      throw new ConflictError("User already exists in this school");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        roleId: role.id,
        schoolId: data.schoolId,
        branchId: data.branchId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        role: { select: { name: true } },
      },
    });
  },

  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      roleName?: string;
      isActive?: boolean;
    }
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError("User");
    }

    let roleId = user.roleId;
    if (data.roleName) {
      const role = await prisma.role.findUnique({
        where: { name: data.roleName },
      });
      if (!role) {
        throw new NotFoundError("Role");
      }
      roleId = role.id;
    }

    return prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        roleId,
        isActive: data.isActive,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        role: { select: { name: true } },
      },
    });
  },

  async delete(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundError("User");
    }

    if (user.role.name === "SUPER_ADMIN") {
      const count = await prisma.user.count({
        where: { role: { name: "SUPER_ADMIN" } },
      });
      if (count <= 1) {
        throw new ConflictError("Cannot delete the last Super Admin");
      }
    }

    await prisma.user.delete({ where: { id } });
    return { success: true };
  },

  async getAuditLogs(query: {
    page?: number;
    limit?: number;
    schoolId?: string;
    isSuperAdmin: boolean;
    requesterSchoolId?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));

    const where: any = {};

    if (query.schoolId) {
      where.schoolId = query.schoolId;
    } else if (!query.isSuperAdmin) {
      where.schoolId = query.requesterSchoolId;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};