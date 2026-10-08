import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import { generateTokens, verifyRefreshToken } from "../middleware/auth";
import { AuthUser } from "../types";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from "../utils/errors";

const buildAuthUser = async (userId: string): Promise<AuthUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError("User");
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roleId: user.roleId,
    roleName: user.role.name,
    schoolId: user.schoolId,
    branchId: user.branchId,
    isSuperAdmin: user.role.name === "SUPER_ADMIN",
    permissions: user.role.rolePermissions.map(
      (rp) => rp.permission.name
    ),
  };
};

export const authService = {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    try {
      const existing = await prisma.user.findFirst({
        where: { email: data.email },
      });

      if (existing) {
        throw new ConflictError("Email already registered");
      }

      const passwordHash = await bcrypt.hash(data.password, 10);

      const superAdminRole = await prisma.role.findUnique({
        where: { name: "SUPER_ADMIN" },
      });

      if (!superAdminRole) {
        throw new Error("SUPER_ADMIN role not seeded");
      }

      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          roleId: superAdminRole.id,
        },
      });

      const authUser = await buildAuthUser(user.id);
      const tokens = generateTokens(authUser);

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entity: "USER",
          entityId: user.id,
        },
      });

      return {
        user: {
          id: authUser.id,
          email: authUser.email,
          firstName: authUser.firstName,
          lastName: authUser.lastName,
          roleName: authUser.roleName,
        },
        ...tokens,
      };
    } catch (error) {
      throw error;
    }
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });

    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    if (!user.isActive) {
      throw new AuthenticationError("Account is deactivated");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AuthenticationError("Invalid email or password");
    }

    const authUser = await buildAuthUser(user.id);
    const tokens = generateTokens(authUser);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        refreshTokens: {
          push: tokens.refreshToken,
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entity: "USER",
        entityId: user.id,
        schoolId: user.schoolId,
      },
    });

    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        roleName: authUser.roleName,
        schoolId: authUser.schoolId,
      },
      ...tokens,
    };
  },

  async refresh(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new AuthenticationError("Invalid refresh token");
      }

      const authUser = await buildAuthUser(user.id);
      const tokens = generateTokens(authUser);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshTokens: user.refreshTokens.filter(
            (token) => token !== refreshToken
          ),
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshTokens: {
            push: tokens.refreshToken,
          },
        },
      });

      return tokens;
    } catch {
      throw new AuthenticationError("Invalid or expired refresh token");
    }
  },

  async logout(userId: string, refreshToken: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          refreshTokens: user.refreshTokens.filter(
            (token) => token !== refreshToken
          ),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: "LOGOUT",
          entity: "USER",
          entityId: userId,
        },
      });
    }
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        school: {
          select: {
            id: true,
            name: true,
            schoolCode: true,
            logo: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("User");
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role.name,
      roleId: user.roleId,
      school: user.school,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User");
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AuthenticationError("Current password is incorrect");
    }

    if (currentPassword === newPassword) {
      throw new ConflictError("New password must be different");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      await tx.user.update({
        where: { id: userId },
        data: { refreshTokens: [] },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "UPDATE",
          entity: "USER",
          entityId: userId,
          schoolId: user.schoolId,
          newValue: { passwordChanged: true },
        },
      });
    });

    return { success: true };
  },
};