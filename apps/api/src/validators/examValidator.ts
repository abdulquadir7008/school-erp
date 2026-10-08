import { z } from "zod";

export const createExamSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    type: z.string().min(1).max(50),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    schoolId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    subjects: z
      .array(
        z.object({
          subjectId: z.string().uuid(),
          maxMarks: z.number().int().min(1),
          passMarks: z.number().int().min(1),
          date: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
        })
      )
      .min(1),
  }),
});

export const updateExamSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    type: z.string().min(1).max(50).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    subjects: z
      .array(
        z.object({
          subjectId: z.string().uuid(),
          maxMarks: z.number().int().min(1),
          passMarks: z.number().int().min(1),
          date: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
        })
      )
      .optional(),
  }),
});

export const updateExamStatusSchema = z.object({
  body: z.object({
    status: z.enum(["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "PUBLISHED"]),
  }),
});
