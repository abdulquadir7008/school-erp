"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
  roleId?: string;
  schoolId?: string;
  school?: {
    id: string;
    name: string;
    logo?: string;
    schoolCode: string;
  };
  permissions?: string[];
  isSuperAdmin?: boolean;
}

interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (data: {
    user: UserInfo;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setUser: (user: UserInfo) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),

      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (
          user.isSuperAdmin ||
          user.roleName === "SUPER_ADMIN" ||
          user.roleName === "SCHOOL_ADMIN"
        ) {
          return true;
        }
        return user.permissions?.includes(permission) || false;
      },
    }),
    {
      name: "schoolsphere-auth",
    }
  )
);