import { prisma } from "../config/database";
import { ROLES } from "../constants/permissions";
import { ConflictError, NotFoundError, TenantError } from "../utils/errors";
import { classService } from "./classService";
import bcrypt from "bcryptjs";

interface CreateSchoolData {
  name: string;
  schoolCode: string;
  registrationNo?: string;
  email: string;
  phone?: string;
  password?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  currency?: string;
}

export const schoolService = {
  async create(data: CreateSchoolData) {
    const existing = await prisma.school.findUnique({
      where: { schoolCode: data.schoolCode.toUpperCase() },
    });

    if (existing) {
      throw new ConflictError("School code already in use");
    }

    const school = await prisma.$transaction(async (tx) => {
      const created = await tx.school.create({
        data: {
          name: data.name,
          schoolCode: data.schoolCode.toUpperCase(),
          registrationNo: data.registrationNo,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country || "IN",
          timezone: data.timezone || "Asia/Kolkata",
          currency: data.currency || "INR",
        },
      });

      const starterPlan = await tx.subscriptionPlan.findFirst({
        where: { name: "STARTER" },
      });

      if (starterPlan) {
        await tx.subscription.create({
          data: {
            schoolId: created.id,
            planId: starterPlan.id,
            status: "TRIAL",
            startDate: new Date(),
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Admin login for the school
      const adminRole = await tx.role.findUnique({
        where: { name: "SCHOOL_ADMIN" },
      });
      if (adminRole) {
        const adminEmail = data.email.toLowerCase();
        const adminExists = await tx.user.findFirst({
          where: { email: adminEmail, schoolId: created.id },
        });
        if (!adminExists) {
          await tx.user.create({
            data: {
              email: adminEmail,
              passwordHash: await bcrypt.hash(data.password || "School@2024", 10),
              firstName: "Admin",
              lastName: created.name.split(" ")[0] || "School",
              roleId: adminRole.id,
              schoolId: created.id,
            },
          });
        }
      }

      // Seed the academic structure (current April–March year + LKG–12
      // classes + Section A) so admission/attendance/fees dropdowns work
      // immediately for the new school.
      await classService.seedForNewSchool(tx, created.id);

      return created;
    },
    // School creation seeds ~30 rows; allow headroom on slow connections.
    { timeout: 30000 });

    return school;
  },

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    schoolId?: string;
    isSuperAdmin: boolean;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));

    const where: any = {};

    if (!query.isSuperAdmin && query.schoolId) {
      where.id = query.schoolId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { schoolCode: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, schools] = await Promise.all([
      prisma.school.count({ where }),
      prisma.school.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          subscription: { include: { plan: true } },
          _count: {
            select: {
              students: true,
              teachers: true,
              branches: true,
              users: true,
            },
          },
        },
      }),
    ]);

    const schoolIds = schools.map((s) => s.id);
    const adminUsers = await prisma.user.findMany({
      where: { schoolId: { in: schoolIds }, role: { name: "SCHOOL_ADMIN" } },
      select: { schoolId: true, email: true },
    });
    const adminEmailBySchool = new Map(
      adminUsers.map((u) => [u.schoolId, u.email])
    );

    return {
      data: schools.map((s) => ({
        ...s,
        adminEmail: adminEmailBySchool.get(s.id) || null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(id: string, isSuperAdmin: boolean, requesterSchoolId?: string) {
    if (!isSuperAdmin && requesterSchoolId !== id) {
      throw new TenantError();
    }

    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        branches: true,
        classes: { include: { sections: true } },
        _count: {
          select: {
            students: true,
            teachers: true,
            users: true,
            invoices: true,
          },
        },
      },
    });

    if (!school) {
      throw new NotFoundError("School");
    }

    return school;
  },

  async update(
    id: string,
    data: Partial<CreateSchoolData>,
    isSuperAdmin: boolean,
    requesterSchoolId?: string
  ) {
    if (!isSuperAdmin && requesterSchoolId !== id) {
      throw new TenantError();
    }

    const existing = await prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("School");
    }

    if (data.email && data.email.toLowerCase() !== existing.email) {
      const duplicate = await prisma.school.findFirst({
        where: { email: data.email.toLowerCase() },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("School email already in use");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const school = await tx.school.update({
        where: { id },
        data: {
          ...data,
          email: data.email ? data.email.toLowerCase() : undefined,
        },
      });

      if (data.email && data.email.toLowerCase() !== existing.email) {
        const collision = await tx.user.findFirst({
          where: {
            schoolId: id,
            role: { name: { not: "SCHOOL_ADMIN" } },
            email: data.email.toLowerCase(),
          },
        });
        if (collision) {
          throw new ConflictError(
            "Email already used by another user in this school"
          );
        }
        await tx.user.updateMany({
          where: { schoolId: id, role: { name: "SCHOOL_ADMIN" } },
          data: { email: data.email.toLowerCase() },
        });
        await tx.auditLog.create({
          data: {
            action: "UPDATE",
            entity: "SCHOOL",
            entityId: id,
            schoolId: id,
            oldValue: { email: existing.email },
            newValue: { email: data.email.toLowerCase() },
          },
        });
      }

      return school;
    });

    return updated;
  },

  async setStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
    isSuperAdmin: boolean
  ) {
    if (!isSuperAdmin) {
      throw new TenantError("Only Super Admin can change school status");
    }

    const existing = await prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("School");
    }

    return prisma.school.update({
      where: { id },
      data: { status },
    });
  },

  async resetAdminPassword(id: string, password: string) {
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      throw new NotFoundError("School");
    }

    const adminUser = await prisma.user.findFirst({
      where: {
        schoolId: id,
        role: { name: "SCHOOL_ADMIN" },
      },
    });

    if (!adminUser) {
      throw new NotFoundError("School admin user");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: adminUser.id },
        data: { passwordHash: await bcrypt.hash(password, 10) },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "USER",
          entityId: adminUser.id,
          schoolId: id,
          newValue: { passwordReset: true, email: adminUser.email },
        },
      });
    });

    return { success: true, adminEmail: adminUser.email };
  },

  async delete(id: string, isSuperAdmin: boolean) {
    if (!isSuperAdmin) {
      throw new TenantError("Only Super Admin can delete a school");
    }

    const existing = await prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("School");
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "SCHOOL",
          entityId: id,
          schoolId: id,
          oldValue: { name: existing.name, schoolCode: existing.schoolCode },
        },
      });
      await tx.school.delete({ where: { id } });
    });

    return { success: true };
  },

  async getDashboardStats(schoolId: string, isSuperAdmin: boolean) {
    const [
      totalSchools,
      activeSchools,
      totalStudents,
      totalTeachers,
      totalStaff,
      todayAttendance,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { status: "ACTIVE" } }),
      prisma.student.count({ where: isSuperAdmin ? {} : { schoolId } }),
      prisma.teacher.count({ where: isSuperAdmin ? {} : { schoolId } }),
      prisma.employee.count({ where: isSuperAdmin ? {} : { schoolId } }),
      prisma.attendance.count({
        where: {
          date: new Date(new Date().toISOString().slice(0, 10)),
          ...(isSuperAdmin ? {} : { schoolId }),
        },
      }),
    ]);

    const pendingFees = isSuperAdmin
      ? await prisma.invoice.aggregate({
          _sum: { totalAmount: true, paidAmount: true },
          where: {
            NOT: { status: { in: ["CANCELLED", "REFUNDED"] } },
          },
        })
      : await prisma.invoice.aggregate({
          _sum: { totalAmount: true, paidAmount: true },
          where: {
            schoolId,
            NOT: { status: { in: ["CANCELLED", "REFUNDED"] } },
          },
        });

    const pendingFeeAmount =
      Number(pendingFees._sum.totalAmount || 0) -
      Number(pendingFees._sum.paidAmount || 0);

    return {
      totalSchools: isSuperAdmin ? totalSchools : 1,
      activeSchools: isSuperAdmin ? activeSchools : 1,
      totalStudents,
      totalTeachers,
      totalStaff,
      pendingFees: pendingFeeAmount,
      todayAttendance,
      monthlyRevenue: 0,
    };
  },
};

export const initializeRoles = async () => {
  // NOTE: intentionally NOT wrapped in a single interactive transaction.
  // On free-tier hosting (slow cold starts, pooled/proxied Postgres) a
  // ~200-statement seed transaction exceeds Prisma's default 5s
  // interactive-transaction timeout and dies with P2028. Per-row upserts
  // are slower but survive any connection, and reruns resume safely.
  for (const roleDef of ROLES) {
    let role = await prisma.role.findUnique({
      where: { name: roleDef.name },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        },
      });
    }

    for (const permission of roleDef.permissions) {
      let perm = await prisma.permission.findUnique({
        where: { name: permission },
      });

      if (!perm) {
        const [module, action] = permission.split(".");
        perm = await prisma.permission.create({
          data: {
            name: permission,
            module,
            action,
          },
        });
      }

      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
      });
      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }
  }
};

/** Ensures the global super admin from env config exists and carries the
 *  configured password. Idempotent — safe to run on every boot. */
export const ensureSuperAdmin = async (email: string, password: string) => {
  const normalizedEmail = email.toLowerCase();
  const role = await prisma.role.findUnique({
    where: { name: "SUPER_ADMIN" },
  });
  if (!role) {
    throw new Error("SUPER_ADMIN role not found — run initializeRoles() first");
  }

  const existing = await prisma.user.findFirst({
    where: { email: normalizedEmail, schoolId: null },
  });

  if (existing) {
    const same = await bcrypt.compare(password, existing.passwordHash);
    if (same) return "unchanged" as const;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        roleId: role.id,
        isActive: true,
      },
    });
    return "password-updated" as const;
  }

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      firstName: "Super",
      lastName: "Admin",
      roleId: role.id,
    },
  });
  return "created" as const;
};

export const createDefaultSubscriptionPlans = async () => {
  const existing = await prisma.subscriptionPlan.findFirst();
  if (existing) {
    return;
  }

  await prisma.subscriptionPlan.createMany({
    data: [
      {
        name: "FREE",
        description: "Free tier for small schools",
        price: 0,
        maxSchools: 1,
        maxStudents: 100,
        maxStaff: 20,
        maxStorage: 1024,
        features: ["Students", "Attendance", "Fees"],
        billingPeriod: "monthly",
      },
      {
        name: "STARTER",
        description: "For growing schools",
        price: 2999,
        maxSchools: 1,
        maxStudents: 500,
        maxStaff: 50,
        maxStorage: 5120,
        features: ["Students", "Attendance", "Fees", "Exams", "Library"],
        billingPeriod: "monthly",
      },
      {
        name: "PROFESSIONAL",
        description: "Complete ERP suite",
        price: 7999,
        maxSchools: 3,
        maxStudents: 2000,
        maxStaff: 200,
        maxStorage: 20480,
        features: [
          "Students",
          "Attendance",
          "Fees",
          "Exams",
          "Library",
          "Transport",
          "HR",
          "Inventory",
        ],
        billingPeriod: "monthly",
      },
      {
        name: "ENTERPRISE",
        description: "Multi-school enterprise solution",
        price: 19999,
        maxSchools: 20,
        maxStudents: 10000,
        maxStaff: 1000,
        maxStorage: 102400,
        features: [
          "Students",
          "Attendance",
          "Fees",
          "Exams",
          "Library",
          "Transport",
          "HR",
          "Inventory",
          "AI Assistant",
          "Custom Branding",
        ],
        billingPeriod: "monthly",
      },
    ],
  });
};