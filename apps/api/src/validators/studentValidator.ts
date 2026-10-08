import { z } from "zod";

export const createStudentSchema = z.object({
  body: z.object({
    admissionNumber: z.string().min(1).max(50),
    studentId: z.string().max(50).optional(),
    firstName: z.string().min(1).max(100),
    middleName: z.string().max(100).optional(),
    lastName: z.string().min(1).max(100),
    dateOfBirth: z.string().datetime().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    bloodGroup: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    classId: z.string().uuid(),
    sectionId: z.string().uuid().optional(),
    rollNumber: z.number().int().positive().optional(),
    branchId: z.string().uuid().optional(),
    schoolId: z.string().uuid().optional(),
    guardians: z
      .array(
        z.object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          relation: z.string().min(1),
          phone: z.string().min(10),
          email: z.string().email().optional(),
        })
      )
      .max(3)
      .optional(),
  }),
});

export const updateStudentSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    middleName: z.string().max(100).optional(),
    lastName: z.string().min(1).optional(),
    dateOfBirth: z.string().datetime().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    bloodGroup: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    rollNumber: z.number().int().positive().optional(),
  }),
});