import { Request } from "express";

export interface AuthUser {
  id: string;
  email: string;
  username?: string | null;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  schoolId: string | null;
  branchId: string | null;
  permissions: string[];
  isSuperAdmin: boolean;
  studentId?: string | null;
  teacherId?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message: string;
  code?: string;
  errors?: unknown[];
}
