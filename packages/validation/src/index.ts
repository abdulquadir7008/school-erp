import { z } from "zod";

export const emailSchema = z.string().email().max(255);

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().max(255).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const dateSchema = z.coerce.date();

export const phoneSchema = z.string().regex(/^\+?[0-9]{10,15}$/);

export const createStudentSchema = z.object({
  admissionNumber: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
  dateOfBirth: dateSchema.optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  guardians: z
    .array(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        relation: z.string().min(1),
        phone: phoneSchema,
        email: emailSchema.optional(),
      })
    )
    .max(3)
    .optional(),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  items: z
    .array(
      z.object({
        feeCategoryId: z.string().uuid(),
        description: z.string().min(1),
        amount: z.coerce.number().positive(),
      })
    )
    .min(1),
  dueDate: dateSchema.optional(),
});