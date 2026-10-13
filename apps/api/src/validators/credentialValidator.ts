import { z } from "zod";

export const provisionSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(64).optional(),
    password: z.string().min(8).max(100).optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const bulkProvisionSchema = z.object({
  body: z.object({
    kind: z.enum(["student", "teacher"]),
    ids: z.array(z.string().uuid()).min(1).max(200),
    schoolId: z.string().uuid().optional(),
  }),
});

export const setActiveSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});
