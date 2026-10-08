export interface UserRole {
  id: string;
  name: string;
  description?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  schoolId: string | null;
  branchId: string | null;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message: string;
  code?: string;
  errors?: unknown[];
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface School {
  id: string;
  name: string;
  schoolCode: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

export interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  admissionDate: string;
  status: string;
}

export type RoleName =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "BRANCH_ADMIN"
  | "PRINCIPAL"
  | "VICE_PRINCIPAL"
  | "TEACHER"
  | "ACCOUNTANT"
  | "HR_MANAGER"
  | "LIBRARIAN"
  | "TRANSPORT_MANAGER"
  | "RECEPTIONIST"
  | "STAFF"
  | "STUDENT"
  | "PARENT";