import { z } from "zod";

export const createClassSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Class name must be at least 2 characters").max(60),
    code: z.string().min(1, "Class code is required").max(20),
    academicYearId: z.string().uuid("Invalid academic year").optional(),
  }),
});

export const createSectionSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Section name is required").max(10),
    capacity: z.number().int().min(1).max(500).optional(),
  }),
});
