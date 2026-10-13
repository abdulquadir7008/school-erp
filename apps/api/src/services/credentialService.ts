import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../config/database";
import {
  ConflictError,
  NotFoundError,
  TenantError,
} from "../utils/errors";

export function generateTempPassword(length = 10): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%";
  const all = upper + lower + digits + symbols;
  const bytes = crypto.randomBytes(length);
  let pwd = "";
  // guarantee at least one of each class
  pwd += upper[bytes[0] % upper.length];
  pwd += lower[bytes[1] % lower.length];
  pwd += digits[bytes[2] % digits.length];
  pwd += symbols[bytes[3] % symbols.length];
  for (let i = 4; i < length; i++) {
    pwd += all[bytes[i] % all.length];
  }
  // shuffle
  return pwd
    .split("")
    .sort(() => crypto.randomInt(-1, 2))
    .join("");
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

async function ensureUniqueUsername(base: string, schoolId: string): Promise<string> {
  let candidate = base;
  let suffix = 0;
  for (let i = 0; i < 50; i++) {
    const existing = await prisma.user.findFirst({
      where: { username: candidate, schoolId },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

function syntheticEmail(username: string, schoolCode: string): string {
  const code = slugify(schoolCode || "school") || "school";
  return `${username}@${code}.schoolsphere.local`;
}

async function getRoleOrThrow(roleName: string) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new NotFoundError(`Role ${roleName}`);
  return role;
}

export const credentialService = {
  generateTempPassword,

  async getStudentAccount(studentId: string, schoolId: string | undefined, isSuperAdmin = false) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true, email: true, username: true, isActive: true,
            lastLoginAt: true, firstName: true, lastName: true,
          },
        },
      },
    });
    if (!student) throw new NotFoundError("Student");
    if (!isSuperAdmin && student.schoolId !== schoolId) throw new TenantError();
    return {
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      hasAccount: !!student.userId,
      user: (student as any).user ?? null,
    };
  },

  async getTeacherAccount(teacherId: string, schoolId: string | undefined, isSuperAdmin = false) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: {
          select: {
            id: true, email: true, username: true, isActive: true,
            lastLoginAt: true, firstName: true, lastName: true,
          },
        },
      },
    });
    if (!teacher) throw new NotFoundError("Teacher");
    if (!isSuperAdmin && teacher.schoolId !== schoolId) throw new TenantError();
    return {
      teacherId: teacher.id,
      employeeId: teacher.employeeId,
      hasAccount: !!teacher.userId,
      user: (teacher as any).user ?? null,
    };
  },

  async provisionStudent(
    studentId: string,
    schoolId: string,
    opts: { username?: string; password?: string } = {},
    actorId?: string
  ) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError("Student");
    if (student.schoolId !== schoolId) throw new TenantError("Student belongs to another school");

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundError("School");

    const role = await getRoleOrThrow("STUDENT");

    // If account already linked, return status (do not rotate password silently)
    if ((student as any).userId) {
      const existing = await prisma.user.findUnique({ where: { id: (student as any).userId } });
      return { created: false, user: existing, tempPassword: null as string | null, username: (existing as any)?.username ?? null };
    }

    const baseUsername =
      slugify(opts.username || `stu${student.admissionNumber}`) || `stu${slugify(student.admissionNumber)}`;
    const username = await ensureUniqueUsername(baseUsername, schoolId);
    const tempPassword = opts.password || generateTempPassword(10);
    const email = student.email?.toLowerCase() || syntheticEmail(username, school.schoolCode);
    const emailClash = await prisma.user.findFirst({ where: { email, schoolId } });
    if (emailClash) throw new ConflictError("Generated email clashes with an existing user");

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          firstName: student.firstName,
          lastName: student.lastName,
          phone: student.phone,
          roleId: role.id,
          schoolId,
          branchId: student.branchId,
        },
      });
      await tx.student.update({ where: { id: studentId }, data: { userId: user.id } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "USER",
          entityId: user.id,
          schoolId,
          newValue: { username, role: "STUDENT", studentId },
        },
      });
      return user;
    });

    return { created: true, user: result, tempPassword, username };
  },

  async provisionTeacher(
    teacherId: string,
    schoolId: string,
    opts: { username?: string; password?: string } = {},
    actorId?: string
  ) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundError("Teacher");
    if (teacher.schoolId !== schoolId) throw new TenantError("Teacher belongs to another school");

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundError("School");

    const role = await getRoleOrThrow("TEACHER");

    if ((teacher as any).userId) {
      const existing = await prisma.user.findUnique({ where: { id: (teacher as any).userId } });
      return { created: false, user: existing, tempPassword: null as string | null, username: (existing as any)?.username ?? null };
    }

    const baseUsername =
      slugify(opts.username || `tch${teacher.employeeId}`) || `tch${slugify(teacher.employeeId)}`;
    const username = await ensureUniqueUsername(baseUsername, schoolId);
    const tempPassword = opts.password || generateTempPassword(10);
    const email = teacher.email?.toLowerCase() || syntheticEmail(username, school.schoolCode);
    const emailClash = await prisma.user.findFirst({ where: { email, schoolId } });
    if (emailClash) throw new ConflictError("Generated email clashes with an existing user");

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          phone: teacher.phone,
          roleId: role.id,
          schoolId,
          branchId: teacher.branchId,
        },
      });
      await tx.teacher.update({ where: { id: teacherId }, data: { userId: user.id } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "USER",
          entityId: user.id,
          schoolId,
          newValue: { username, role: "TEACHER", teacherId },
        },
      });
      return user;
    });

    return { created: true, user: result, tempPassword, username };
  },

  async resetPassword(userId: string, schoolId: string | undefined, isSuperAdmin = false, actorId?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new NotFoundError("User");
    if (!isSuperAdmin && user.schoolId !== schoolId) throw new TenantError();
    if (user.role.name === "SUPER_ADMIN") throw new ConflictError("Cannot reset Super Admin password here");

    const tempPassword = generateTempPassword(10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash, refreshTokens: [] } });
      await tx.auditLog.create({
        data: {
          userId: actorId, action: "UPDATE", entity: "USER", entityId: userId,
          schoolId: user.schoolId, newValue: { passwordReset: true },
        },
      });
    });
    return { tempPassword, username: (user as any).username ?? null, email: user.email };
  },

  async setActive(userId: string, isActive: boolean, schoolId: string | undefined, isSuperAdmin = false, actorId?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new NotFoundError("User");
    if (!isSuperAdmin && user.schoolId !== schoolId) throw new TenantError();
    if (user.role.name === "SUPER_ADMIN") throw new ConflictError("Cannot deactivate Super Admin");
    const updated = await prisma.user.update({ where: { id: userId }, data: { isActive, refreshTokens: isActive ? undefined : [] } });
    await prisma.auditLog.create({
      data: {
        userId: actorId, action: "UPDATE", entity: "USER", entityId: userId,
        schoolId: user.schoolId, newValue: { isActive },
      },
    });
    return updated;
  },

  async unlink(studentOrTeacher: "student" | "teacher", id: string, schoolId: string, actorId?: string) {
    if (studentOrTeacher === "student") {
      const student = await prisma.student.findUnique({ where: { id } });
      if (!student) throw new NotFoundError("Student");
      if (student.schoolId !== schoolId) throw new TenantError();
      const userId = (student as any).userId;
      await prisma.$transaction(async (tx) => {
        await tx.student.update({ where: { id }, data: { userId: null } });
        if (userId) {
          await tx.user.update({ where: { id: userId }, data: { isActive: false, refreshTokens: [] } });
          await tx.auditLog.create({
            data: { userId: actorId, action: "UPDATE", entity: "USER", entityId: userId, schoolId, newValue: { unlinkedStudent: id } },
          });
        }
      });
      return { success: true };
    } else {
      const teacher = await prisma.teacher.findUnique({ where: { id } });
      if (!teacher) throw new NotFoundError("Teacher");
      if (teacher.schoolId !== schoolId) throw new TenantError();
      const userId = (teacher as any).userId;
      await prisma.$transaction(async (tx) => {
        await tx.teacher.update({ where: { id }, data: { userId: null } });
        if (userId) {
          await tx.user.update({ where: { id: userId }, data: { isActive: false, refreshTokens: [] } });
          await tx.auditLog.create({
            data: { userId: actorId, action: "UPDATE", entity: "USER", entityId: userId, schoolId, newValue: { unlinkedTeacher: id } },
          });
        }
      });
      return { success: true };
    }
  },

  async bulkProvision(
    kind: "student" | "teacher",
    ids: string[],
    schoolId: string,
    actorId?: string
  ) {
    const results: Array<{ id: string; ok: boolean; username?: string | null; tempPassword?: string | null; error?: string }> = [];
    for (const id of ids.slice(0, 200)) {
      try {
        const r =
          kind === "student"
            ? await this.provisionStudent(id, schoolId, {}, actorId)
            : await this.provisionTeacher(id, schoolId, {}, actorId);
        results.push({ id, ok: true, username: r.username, tempPassword: r.tempPassword });
      } catch (e: any) {
        results.push({ id, ok: false, error: e?.message || "Failed" });
      }
    }
    return results;
  },

  async listAccounts(query: {
    schoolId?: string; roleName?: string; search?: string;
    page?: number; limit?: number; hasAccount?: boolean;
    isSuperAdmin: boolean; requesterSchoolId?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));
    const schoolId = query.isSuperAdmin ? query.schoolId : query.requesterSchoolId;
    if (!schoolId && !query.isSuperAdmin) throw new TenantError("School context required");

    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (query.roleName) where.role = { name: query.roleName };
    else where.role = { name: { in: ["STUDENT", "TEACHER"] } };
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: "insensitive" } },
        { username: { contains: query.search, mode: "insensitive" } },
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
        select: {
          id: true, email: true, username: true, firstName: true, lastName: true,
          isActive: true, lastLoginAt: true, createdAt: true,
          role: { select: { name: true } },
          studentProfile: { select: { id: true, admissionNumber: true, class: { select: { name: true } } } },
          teacherProfile: { select: { id: true, employeeId: true } },
        },
      }),
    ]);
    return { data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  /**
   * Records that have no linked login yet — powers bulk provisioning in the
   * web dashboard (select N students/teachers → create logins in one shot).
   */
  async listUnprovisioned(query: {
    kind: "student" | "teacher";
    schoolId?: string;
    search?: string;
    page?: number;
    limit?: number;
    isSuperAdmin: boolean;
    requesterSchoolId?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));
    const schoolId = query.isSuperAdmin ? query.schoolId : query.requesterSchoolId;
    if (!schoolId && !query.isSuperAdmin) throw new TenantError("School context required");

    const searchFilter = query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" as const } },
            { lastName: { contains: query.search, mode: "insensitive" as const } },
            ...(query.kind === "student"
              ? [{ admissionNumber: { contains: query.search, mode: "insensitive" as const } }]
              : [{ employeeId: { contains: query.search, mode: "insensitive" as const } }]),
          ],
        }
      : {};

    if (query.kind === "student") {
      const where: any = { schoolId, userId: null, ...searchFilter };
      const [total, rows] = await Promise.all([
        prisma.student.count({ where }),
        prisma.student.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, firstName: true, lastName: true, admissionNumber: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
          },
        }),
      ]);
      return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    const where: any = { schoolId, userId: null, ...searchFilter };
    const [total, rows] = await Promise.all([
      prisma.teacher.count({ where }),
      prisma.teacher.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, firstName: true, lastName: true, employeeId: true, specialization: true },
      }),
    ]);
    return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },
};
