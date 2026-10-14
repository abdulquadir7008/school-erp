import { z } from "zod";

const homeworkPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const homeworkStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const submissionStatus = z.enum(["PENDING", "COMPLETED", "NOT_SUBMITTED"]);

const attachmentsSchema = z
  .array(z.string().trim().min(1).max(2000))
  .max(10)
  .optional();

export const createTimetableSchema = z.object({
  body: z.object({
    classId: z.string().uuid(),
    subjectId: z.string().uuid(),
    teacherId: z.string().uuid(),
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: z.string().min(1).max(10),
    endTime: z.string().min(1).max(10),
    room: z.string().max(50).optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const createHomeworkSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    classId: z.string().uuid(),
    sectionId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    homeworkDate: z.string().min(1).optional(),
    dueDate: z.string().min(1),
    priority: homeworkPriority.optional(),
    status: homeworkStatus.optional(),
    attachments: attachmentsSchema,
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateHomeworkSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(5000).nullable().optional(),
      sectionId: z.string().uuid().nullable().optional(),
      subjectId: z.string().uuid().nullable().optional(),
      academicYearId: z.string().uuid().nullable().optional(),
      homeworkDate: z.string().min(1).optional(),
      dueDate: z.string().min(1).optional(),
      priority: homeworkPriority.optional(),
      status: homeworkStatus.optional(),
      attachments: z.array(z.string().trim().min(1).max(2000)).max(10).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" }),
});

export const homeworkIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const updateCompletionsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    updates: z
      .array(
        z.object({
          studentId: z.string().uuid(),
          status: submissionStatus,
          teacherRemark: z.string().max(1000).nullable().optional(),
        })
      )
      .min(1)
      .max(500),
  }),
});

export const studentSubmitHomeworkSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    submissionText: z.string().max(5000).nullable().optional(),
    attachmentUrl: z.string().max(2000).nullable().optional(),
  }),
});

export const homeworkRemindersSchema = z.object({
  body: z.object({
    hoursAhead: z.number().int().min(1).max(168).optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const createAssignmentSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    classId: z.string().uuid(),
    subjectId: z.string().uuid().optional(),
    totalMarks: z.number().int().min(1).max(1000).optional(),
    dueDate: z.string().min(1),
    schoolId: z.string().uuid().optional(),
  }),
});

export const enterMarksSchema = z.object({
  body: z.object({
    examSubjectId: z.string().uuid(),
    marks: z
      .array(
        z.object({
          studentId: z.string().uuid(),
          marksObtained: z.number().int().min(0).nullable(),
          remarks: z.string().max(500).optional(),
        })
      )
      .min(1)
      .max(500),
  }),
});
