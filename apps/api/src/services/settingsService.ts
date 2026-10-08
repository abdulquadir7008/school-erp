import nodemailer from "nodemailer";
import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  TenantError,
} from "../utils/errors";

type SectionKey =
  | "branding"
  | "general"
  | "security"
  | "email"
  | "whatsapp"
  | "notifications"
  | "payment";

const SECTIONS: SectionKey[] = [
  "branding",
  "general",
  "security",
  "email",
  "whatsapp",
  "notifications",
  "payment",
];

const DEFAULTS: Record<SectionKey, Record<string, unknown>> = {
  branding: {
    logo: "",
    primaryColor: "#4f46e5",
    accentColor: "#0ea5e9",
    themeMode: "light",
    tagline: "",
  },
  general: {
    timezone: "Asia/Kolkata",
    currency: "INR",
    language: "en",
    attendanceGraceMinutes: 10,
    feeReminderDays: 3,
  },
  security: {
    requireTwoFactor: false,
    passwordExpiryDays: 90,
    sessionTimeoutMinutes: 30,
    maxLoginAttempts: 5,
    strongPasswords: true,
  },
  email: {
    provider: "smtp",
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    feeReceipts: true,
    examResults: true,
    announcements: true,
  },
  whatsapp: {
    enabled: false,
    provider: "gupshup",
    apiKey: "",
    senderId: "",
    businessNumber: "",
    feeReminders: true,
    attendanceAlerts: true,
  },
  notifications: {
    inApp: true,
    email: true,
    sms: false,
    push: false,
    feeDue: true,
    attendance: true,
    examResults: true,
    announcements: true,
    leaveRequests: false,
  },
  payment: {
    gateway: "razorpay",
    razorpayKeyId: "",
    razorpayKeySecret: "",
    stripeSecretKey: "",
    stripePublishableKey: "",
  },
};

const resolveSchoolId = (user: AuthUser, querySchoolId?: string): string => {
  if (user.isSuperAdmin) {
    if (!querySchoolId) {
      throw new TenantError(
        "A schoolId query parameter is required for super admin"
      );
    }
    return querySchoolId;
  }
  if (!user.schoolId) {
    throw new TenantError("No school context for this account");
  }
  return user.schoolId;
};

export const settingsService = {
  async get(user: AuthUser, querySchoolId?: string) {
    const schoolId = resolveSchoolId(user, querySchoolId);

    const [school, row] = await Promise.all([
      prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          id: true,
          name: true,
          schoolCode: true,
          registrationNo: true,
          logo: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          country: true,
          timezone: true,
          currency: true,
          website: true,
          principalName: true,
          status: true,
        },
      }),
      prisma.schoolSetting.findUnique({ where: { schoolId } }),
    ]);

    if (!school) {
      throw new NotFoundError("School");
    }

    const merged = {} as Record<string, Record<string, unknown>>;
    for (const section of SECTIONS) {
      merged[section] = {
        ...DEFAULTS[section],
        ...((row?.[section] as Record<string, unknown>) || {}),
      };
    }

    return {
      school,
      branding: merged.branding,
      general: merged.general,
      security: merged.security,
      email: merged.email,
      whatsapp: merged.whatsapp,
      notifications: merged.notifications,
      payment: merged.payment,
    };
  },

  async update(
    user: AuthUser,
    patch: Record<string, Record<string, unknown>>,
    querySchoolId?: string
  ) {
    const schoolId = resolveSchoolId(user, querySchoolId);
    const existing = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundError("School");
    }

    const current = await prisma.schoolSetting.findUnique({
      where: { schoolId },
    });

    const data: Record<string, unknown> = {};
    for (const section of SECTIONS) {
      const incoming = patch[section];
      if (incoming === undefined) continue;
      const prev = (current?.[section] as Record<string, unknown>) || {};
      data[section] = { ...prev, ...incoming };
    }

    if (Object.keys(data).length === 0) {
      throw new TenantError("Nothing to update");
    }

    const upserted = await prisma.schoolSetting.upsert({
      where: { schoolId },
      create: { schoolId, ...(data as any) },
      update: data as any,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entity: "SCHOOL",
        entityId: schoolId,
        schoolId,
        newValue: { settings: Object.keys(data) },
      },
    });

    const merged = {} as Record<string, Record<string, unknown>>;
    for (const section of SECTIONS) {
      merged[section] = {
        ...DEFAULTS[section],
        ...((upserted[section] as Record<string, unknown>) || {}),
      };
    }

    return merged;
  },

  async listRoles(user: AuthUser, querySchoolId?: string) {
    const schoolId = resolveSchoolId(user, querySchoolId);

    const where = user.isSuperAdmin
      ? {}
      : {
          OR: [{ schoolId }, { schoolId: null }],
        };

    const [roles, permissions, users] = await Promise.all([
      prisma.role.findMany({
        where,
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.permission.findMany({
        orderBy: [{ module: "asc" }, { action: "asc" }],
      }),
      prisma.user.groupBy({
        by: ["roleId"],
        _count: { _all: true },
      }),
    ]);

    const userCounts = new Map(
      users.map((u) => [u.roleId, u._count._all])
    );

    const grouped: Record<string, { action: string; name: string }[]> = {};
    for (const perm of permissions) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push({ action: perm.action, name: perm.name });
    }

    return {
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        schoolId: role.schoolId,
        editable: !role.isSystem,
        userCount: userCounts.get(role.id) || 0,
        permissions: role.rolePermissions.map((rp) => rp.permission.name),
      })),
      modules: Object.keys(grouped).map((module) => ({
        module,
        permissions: grouped[module],
      })),
    };
  },

  async createRole(
    user: AuthUser,
    data: { name: string; description?: string; permissions?: string[] },
    querySchoolId?: string
  ) {
    const schoolId = resolveSchoolId(user, querySchoolId);
    const name = data.name.toUpperCase();

    const existing = await prisma.role.findFirst({ where: { name } });
    if (existing) {
      throw new ConflictError("Role name already exists");
    }

    const names = data.permissions || [];
    const permissionNames = await prisma.permission.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });

    if (permissionNames.length !== names.length) {
      throw new NotFoundError("One or more permissions do not exist");
    }

    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          name,
          description: data.description,
          schoolId,
          isSystem: false,
        },
      });

      if (permissionNames.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionNames.map((p) => ({
            roleId: created.id,
            permissionId: p.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          entity: "ROLE",
          entityId: created.id,
          schoolId,
          newValue: { name, description: data.description },
        },
      });

      return created;
    });

    return role;
  },

  async updateRole(
    user: AuthUser,
    roleId: string,
    data: { name?: string; description?: string; permissions?: string[] },
    querySchoolId?: string
  ) {
    const schoolId = resolveSchoolId(user, querySchoolId);
    const role = await prisma.role.findUnique({ where: { id: roleId } });

    if (!role) {
      throw new NotFoundError("Role");
    }

    if (role.isSystem) {
      throw new AuthorizationError("System roles cannot be modified");
    }

    if (!user.isSuperAdmin && role.schoolId !== schoolId) {
      throw new TenantError();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const sync = await tx.role.update({
        where: { id: roleId },
        data: {
          name: data.name ? data.name.toUpperCase() : undefined,
          description: data.description,
        },
      });

      if (data.permissions) {
        const permissionNames = await tx.permission.findMany({
          where: { name: { in: data.permissions! } },
          select: { id: true, name: true },
        });
        if (permissionNames.length !== data.permissions!.length) {
          throw new NotFoundError("One or more permissions do not exist");
        }

        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: permissionNames.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          entity: "ROLE",
          entityId: roleId,
          schoolId,
          newValue: data,
        },
      });

      return sync;
    });

    return updated;
  },

  async sendTest(
    user: AuthUser,
    channel: "email" | "whatsapp",
    to: string,
    querySchoolId?: string
  ) {
    const schoolId = resolveSchoolId(user, querySchoolId);

    if (channel === "email") {
      const row = await prisma.schoolSetting.findUnique({
        where: { schoolId },
      });
      const config = {
        ...DEFAULTS.email,
        ...((row?.email as Record<string, unknown>) || {}),
      } as Record<string, any>;

      if (!config.host) {
        throw new TenantError(
          "SMTP host is not configured. Save your email settings first."
        );
      }

      const transporter = nodemailer.createTransport({
        host: config.host,
        port: Number(config.port) || 587,
        secure: Boolean(config.secure),
        auth:
          config.username && config.password
            ? { user: config.username, pass: config.password }
            : undefined,
      });

      await transporter.sendMail({
        from: `"${config.fromName || "SchoolSphere"}" <${
          config.fromEmail || config.username || "no-reply@schoolsphere.local"
        }>`,
        to,
        subject: "SchoolSphere - Test Email",
        text: "This is a test email from your school settings. If you are reading this, your SMTP configuration is working correctly.",
        html: `<p>This is a test email from your school settings.</p><p>If you are reading this, your SMTP configuration is working correctly.</p>`,
      });

      return { sent: true, channel: "email", to };
    }

    // WhatsApp delivery is simulated - plug in a real provider SDK here.
    return { sent: true, channel: "whatsapp", to, simulated: true };
  },
};