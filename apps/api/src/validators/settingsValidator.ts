import { z } from "zod";

const supportedLanguages = z.enum(["en", "ar"]);

const generalSchema = z
  .record(z.string(), z.any())
  .refine(
    (v) => v.language === undefined || supportedLanguages.safeParse(v.language).success,
    {
      message: "Interface language must be one of: en, ar",
    }
  );

export const updateSettingsSchema = z.object({
  body: z
    .object({
      branding: z.record(z.string(), z.any()).optional(),
      general: generalSchema.optional(),
      security: z.record(z.string(), z.any()).optional(),
      email: z.record(z.string(), z.any()).optional(),
      whatsapp: z.record(z.string(), z.any()).optional(),
      notifications: z.record(z.string(), z.any()).optional(),
      payment: z.record(z.string(), z.any()).optional(),
    })
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
      message: "At least one settings section must be provided",
    }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, "School name must be at least 2 characters").optional(),
    registrationNo: z.string().optional(),
    email: z.string().email("Invalid email").optional(),
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

export const createRoleSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Role name must be at least 2 characters")
      .max(30),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  }),
});

export const updateRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(30).optional(),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  }),
});

export const testChannelSchema = z.object({
  body: z.object({
    channel: z.enum(["email", "whatsapp"]),
    to: z.string().min(3, "Recipient is required"),
  }),
});