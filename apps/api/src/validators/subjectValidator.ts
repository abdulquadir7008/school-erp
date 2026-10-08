import { z } from "zod";

export const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(20),
    schoolId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
  }),
});

export const updateSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(20).optional(),
    departmentId: z.string().uuid().nullable().optional(),
  }),
});