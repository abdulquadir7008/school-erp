import { z } from "zod";

const examType = z.enum(["Unit Test", "Monthly Test", "Mid-Term", "Final", "Practical", "Mock Exam"]);
const examStatus = z.enum(["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "PUBLISHED", "ARCHIVED"]);

const timetableEntry = z.object({
  subjectId: z.string().uuid(),
  maxMarks: z.number().int().min(1).max(1000),
  passMarks: z.number().int().min(0).max(1000),
  date: z.string().optional(),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM").optional(),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM").optional(),
  durationMin: z.number().int().min(1).max(1440).optional(),
  room: z.string().max(100).optional(),
  invigilatorId: z.string().uuid().optional(),
  instructions: z.string().max(2000).optional(),
});

export const createExamSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    type: examType,
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    schoolId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    durationMin: z.number().int().min(1).max(14400).optional(),
    instructions: z.string().max(5000).optional(),
    gradingPolicy: z
      .object({
        boundaries: z.record(z.string(), z.number().min(0).max(100)).optional(),
        rankEnabled: z.boolean().optional(),
        tieMethod: z.enum(["dense", "competition"]).optional(),
      })
      .optional(),
    classes: z
      .array(z.object({ classId: z.string().uuid(), sectionId: z.string().uuid().optional() }))
      .min(1)
      .max(100)
      .optional(),
    subjects: z.array(timetableEntry).min(1).max(100),
  }),
});

export const updateExamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      type: examType.optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      academicYearId: z.string().uuid().nullable().optional(),
      durationMin: z.number().int().min(1).max(14400).nullable().optional(),
      instructions: z.string().max(5000).nullable().optional(),
      gradingPolicy: z
        .object({
          boundaries: z.record(z.string(), z.number().min(0).max(100)).optional(),
          rankEnabled: z.boolean().optional(),
          tieMethod: z.enum(["dense", "competition"]).optional(),
        })
        .nullable()
        .optional(),
      classes: z
        .array(z.object({ classId: z.string().uuid(), sectionId: z.string().uuid().optional() }))
        .min(1)
        .max(100)
        .optional(),
      subjects: z.array(timetableEntry).min(1).max(100).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" }),
});

export const updateExamStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: examStatus,
  }),
});

export const examIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const addExamSubjectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: timetableEntry,
});

export const updateExamSubjectSchema = z.object({
  params: z.object({ id: z.string().uuid(), subjectId: z.string().uuid() }),
  body: z
    .object({
      maxMarks: z.number().int().min(1).max(1000).optional(),
      passMarks: z.number().int().min(0).max(1000).optional(),
      date: z.string().nullable().optional(),
      startTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM").nullable().optional(),
      endTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM").nullable().optional(),
      durationMin: z.number().int().min(1).max(1440).nullable().optional(),
      room: z.string().max(100).nullable().optional(),
      invigilatorId: z.string().uuid().nullable().optional(),
      instructions: z.string().max(2000).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" }),
});

export const marksSubmitSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    examSubjectId: z.string().uuid(),
    studentIds: z.array(z.string().uuid()).max(1000).optional(),
  }),
});

export const marksReviewSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    examSubjectId: z.string().uuid(),
    approved: z.array(z.string().uuid()).max(1000).optional(),
    rejected: z
      .array(z.object({ studentId: z.string().uuid(), note: z.string().max(1000).optional() }))
      .max(1000)
      .optional(),
  }).refine((b) => (b.approved?.length || 0) + (b.rejected?.length || 0) > 0, {
    message: "Approve or reject at least one mark",
  }),
});

export const reportCardQuerySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    studentId: z.string().uuid(),
    format: z.enum(["json", "pdf"]).optional(),
  }),
});

export const examRemindersSchema = z.object({
  body: z.object({
    hoursAhead: z.number().int().min(1).max(720).optional(),
    schoolId: z.string().uuid().optional(),
  }),
});
