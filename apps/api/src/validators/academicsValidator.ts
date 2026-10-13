import { z } from "zod";

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
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    classId: z.string().uuid(),
    subjectId: z.string().uuid().optional(),
    dueDate: z.string().min(1),
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
