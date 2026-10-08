import { z } from "zod";

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    roleName: z.string().min(1, "Role required"),
    schoolId: z.string().uuid("Valid school ID required"),
    branchId: z.string().uuid().optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional(),
    roleName: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});