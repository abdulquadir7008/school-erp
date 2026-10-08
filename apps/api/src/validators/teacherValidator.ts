import { z } from "zod";

export const createTeacherSchema = z.object({
  body: z.object({
    employeeId: z.string().min(1).max(50),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().min(10).max(15),
    email: z.string().email().optional(),
    qualification: z.string().max(100).optional(),
    specialization: z.string().max(100).optional(),
    joiningDate: z.string().datetime().optional(),
    schoolId: z.string().uuid().optional(),
    branchId: z.string().uuid().nullable().optional(),
  }),
});

export const updateTeacherSchema = z.object({
  body: z.object({
    employeeId: z.string().min(1).max(50).optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().min(10).max(15).optional(),
    email: z.string().email().optional(),
    qualification: z.string().max(100).optional(),
    specialization: z.string().max(100).optional(),
    joiningDate: z.string().datetime().optional(),
    status: z.string().max(50).optional(),
    schoolId: z.string().uuid().optional(),
    branchId: z.string().uuid().nullable().optional(),
  }),
});