import { z } from "zod";

export const createBookSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300),
    author: z.string().min(1).max(200),
    isbn: z.string().max(50).optional(),
    publisher: z.string().max(200).optional(),
    category: z.string().max(100).optional(),
    edition: z.string().max(50).optional(),
    totalCopies: z.number().int().min(1).max(1000).optional(),
    rack: z.string().max(50).optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateBookSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300).optional(),
    author: z.string().min(1).max(200).optional(),
    isbn: z.string().max(50).optional(),
    publisher: z.string().max(200).optional(),
    category: z.string().max(100).optional(),
    edition: z.string().max(50).optional(),
    totalCopies: z.number().int().min(1).max(1000).optional(),
    rack: z.string().max(50).optional(),
  }),
});

export const createIssueSchema = z.object({
  body: z.object({
    bookId: z.string().uuid(),
    studentId: z.string().uuid(),
    dueDate: z.string().optional(),
  }),
});

export const returnBookSchema = z.object({
  body: z.object({
    fine: z.number().min(0).optional(),
  }),
});