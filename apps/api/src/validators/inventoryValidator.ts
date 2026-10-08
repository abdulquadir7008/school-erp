import { z } from "zod";

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .refine((v) => v == null || v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Invalid date",
  });

export const createItemSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    category: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
    unit: z.string().max(50).optional(),
    quantity: z.coerce.number().int().min(0).optional(),
    minStock: z.coerce.number().int().min(0).optional(),
    purchasePrice: z.coerce.number().min(0).optional().nullable(),
    department: z.string().max(100).optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateItemSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    unit: z.string().max(50).optional(),
    quantity: z.coerce.number().int().min(0).optional(),
    minStock: z.coerce.number().int().min(0).optional(),
    purchasePrice: z.coerce.number().min(0).optional().nullable(),
    department: z.string().max(100).optional().nullable(),
    location: z.string().max(200).optional().nullable(),
  }),
});

export const createTransactionSchema = z.object({
  body: z.object({
    itemId: z.string().uuid(),
    type: z.enum(["IN", "OUT", "ADJUST"]),
    quantity: z.coerce.number().int().min(1),
    note: z.string().max(500).optional().nullable(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const createAssetSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    assetCode: z.string().min(1).max(100),
    category: z.string().min(1).max(100),
    serialNumber: z.string().max(100).optional().nullable(),
    purchaseDate: optionalDate,
    purchasePrice: z.coerce.number().min(0).optional().nullable(),
    warrantyExpiry: optionalDate,
    location: z.string().max(200).optional().nullable(),
    condition: z.string().max(50).optional(),
    assignedTo: z.string().max(200).optional().nullable(),
    department: z.string().max(100).optional().nullable(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateAssetSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    assetCode: z.string().min(1).max(100).optional(),
    category: z.string().min(1).max(100).optional(),
    serialNumber: z.string().max(100).optional().nullable(),
    purchaseDate: optionalDate,
    purchasePrice: z.coerce.number().min(0).optional().nullable(),
    warrantyExpiry: optionalDate,
    location: z.string().max(200).optional().nullable(),
    condition: z.string().max(50).optional(),
    assignedTo: z.string().max(200).optional().nullable(),
    department: z.string().max(100).optional().nullable(),
    status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE", "DISPOSED"]).optional(),
  }),
});