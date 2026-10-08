import { z } from "zod";

export const createSchoolSchema = z.object({
  body: z.object({
    name: z.string().min(2, "School name must be at least 2 characters"),
    schoolCode: z
      .string()
      .min(2, "School code must be at least 2 characters")
      .max(20)
      .toUpperCase(),
    registrationNo: z.string().optional(),
    email: z.string().email("Invalid email"),
    phone: z.string().optional(),
    password: z.string().min(6, "Password must be at least 6 characters").max(100).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().default("IN"),
    timezone: z.string().default("Asia/Kolkata"),
    currency: z.string().default("INR"),
  }),
});

export const updateSchoolSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    registrationNo: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
    currency: z.string().optional(),
    website: z.string().optional(),
    principalName: z.string().optional(),
    logo: z.string().optional(),
  }),
});

export const setSchoolStatusSchema = z.object({
  body: z.object({
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  }),
});

export const resetAdminPasswordSchema = z.object({
  body: z.object({
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100),
  }),
});