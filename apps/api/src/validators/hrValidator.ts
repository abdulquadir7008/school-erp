import { z } from "zod";

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .refine((v) => v == null || v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Invalid date",
  });

export const createEmployeeSchema = z.object({
  body: z.object({
    employeeId: z.string().min(1).max(50).optional(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().max(30).optional().nullable(),
    email: z
      .string()
      .email()
      .max(200)
      .optional()
      .nullable()
      .or(z.literal("")),
    department: z.string().max(100).optional().nullable(),
    designation: z.string().max(100).optional().nullable(),
    joiningDate: optionalDate,
    salary: z.coerce.number().min(0).optional().nullable(),
    branchId: z.string().uuid().optional().nullable(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateEmployeeSchema = z.object({
  body: z.object({
    employeeId: z.string().min(1).max(50).optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().max(30).optional().nullable(),
    email: z
      .string()
      .email()
      .max(200)
      .optional()
      .nullable()
      .or(z.literal("")),
    department: z.string().max(100).optional().nullable(),
    designation: z.string().max(100).optional().nullable(),
    joiningDate: optionalDate,
    salary: z.coerce.number().min(0).optional().nullable(),
    status: z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"]).optional(),
  }),
});

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(20),
    headId: z.string().uuid().optional().nullable(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(20).optional(),
    headId: z.string().uuid().optional().nullable(),
  }),
});

export const createLeaveSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid(),
    type: z.string().min(1).max(50),
    startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
      message: "Invalid start date",
    }),
    endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
      message: "Invalid end date",
    }),
    reason: z.string().max(500).optional().nullable(),
  }),
});

export const updateLeaveStatusSchema = z.object({
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  }),
});

export const generatePayrollSchema = z.object({
  body: z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    schoolId: z.string().uuid().optional(),
  }),
});

export const listPayrollQuery = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});