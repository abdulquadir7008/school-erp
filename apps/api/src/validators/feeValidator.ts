import { z } from "zod";

const feeTypes = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"] as const;
const paymentMethods = [
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CARD",
  "ONLINE",
  "RAZORPAY",
  "STRIPE",
  "CHEQUE",
  "OTHER",
] as const;

export const createInvoiceSchema = z.object({
  body: z.object({
    studentId: z.string().uuid(),
    amount: z.coerce.number().positive(),
    description: z.string().max(255).optional(),
    feeCategoryId: z.string().uuid().optional(),
    discount: z.coerce.number().min(0).optional(),
    fine: z.coerce.number().min(0).optional(),
    dueDate: z.string().datetime().optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const createAcademicYearSchema = z.object({
  body: z.object({
    schoolId: z.string().uuid().optional(),
    name: z.string().min(1).max(60).optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
    status: z.string().max(20).optional(),
  }),
});

export const updateAcademicYearSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(60).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
    status: z.string().max(20).optional(),
  }),
});

const structureBase = {
  name: z.string().min(1).max(120),
  amount: z.coerce.number().positive(),
  feeCategoryId: z.string().uuid(),
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  feeType: z.enum(feeTypes).optional(),
  dueDate: z.string().datetime().optional(),
  isRecurring: z.boolean().optional(),
  recurringType: z.string().max(40).optional(),
  schoolId: z.string().uuid().optional(),
};

export const createStructureSchema = z.object({
  body: z.object(structureBase),
});

export const updateStructureSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    amount: z.coerce.number().positive().optional(),
    feeCategoryId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
    feeType: z.enum(feeTypes).optional(),
    dueDate: z.string().datetime().optional(),
    isRecurring: z.boolean().optional(),
    recurringType: z.string().max(40).optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const generateInvoicesSchema = z.object({
  body: z.object({
    schoolId: z.string().uuid().optional(),
    academicYearId: z.string().uuid(),
    structureIds: z.array(z.string().uuid()).min(1).optional(),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    studentIds: z.array(z.string().uuid()).optional(),
    feeMonths: z.array(z.number().int().min(1).max(12)).optional(),
    feeYear: z.number().int().min(2000).max(2100).optional(),
  }),
});

export const applyFineSchema = z.object({
  body: z.object({
    fine: z.coerce.number().min(0),
    reason: z.string().max(500).optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const sendReceiptSchema = z.object({
  body: z.object({
    channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
    schoolId: z.string().uuid().optional(),
  }),
});

export const createPaymentSchema = z.object({
  body: z.object({
    invoiceId: z.string().uuid(),
    amount: z.coerce.number().positive(),
    method: z.enum(paymentMethods),
    transactionId: z.string().max(100).optional(),
    receivedBy: z.string().uuid().optional(),
    schoolId: z.string().uuid().optional(),
  }),
});