import { z } from "zod";

export const createParentSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().min(10).max(15),
    email: z.string().email().optional(),
    occupation: z.string().max(100).optional(),
    schoolId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
    relation: z.string().min(1).max(50).default("PARENT"),
  }),
});

export const updateParentSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().min(10).max(15).optional(),
    email: z.string().email().optional(),
    occupation: z.string().max(100).optional(),
    schoolId: z.string().uuid().optional(),
    studentId: z.string().uuid().nullable().optional(),
    relation: z.string().min(1).max(50).optional(),
  }),
});