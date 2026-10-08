import { z } from "zod";

export const bulkAttendanceSchema = z.object({
  body: z.object({
    date: z.string().datetime(),
    classId: z.string().uuid().optional(),
    schoolId: z.string().uuid().optional(),
    records: z
      .array(
        z.object({
          studentId: z.string().uuid(),
          status: z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE"]),
          remarks: z.string().max(255).optional(),
        })
      )
      .min(1),
  }),
});