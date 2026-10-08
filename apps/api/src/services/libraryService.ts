import { prisma } from "../config/database";
import { ConflictError, NotFoundError, TenantError } from "../utils/errors";

interface CreateBookData {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  category?: string;
  edition?: string;
  totalCopies?: number;
  rack?: string;
  schoolId: string;
}

interface CreateIssueData {
  bookId: string;
  studentId: string;
  dueDate?: string;
  schoolId: string;
}

const DEFAULT_LOAN_PERIOD_DAYS = 14;

export const libraryService = {
  async createBook(data: CreateBookData) {
    const book = await prisma.$transaction(async (tx) => {
      if (data.isbn) {
        const existing = await tx.book.findFirst({
          where: { schoolId: data.schoolId, isbn: data.isbn },
        });
        if (existing) {
          throw new ConflictError("A book with this ISBN already exists in the library");
        }
      }

      const totalCopies = data.totalCopies ?? 1;

      const created = await tx.book.create({
        data: {
          title: data.title,
          author: data.author,
          isbn: data.isbn,
          publisher: data.publisher,
          category: data.category,
          edition: data.edition,
          totalCopies,
          available: totalCopies,
          rack: data.rack,
          schoolId: data.schoolId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "BOOK",
          entityId: created.id,
          schoolId: data.schoolId,
          newValue: { title: created.title, isbn: created.isbn },
        },
      });

      return created;
    });

    return book;
  },

  async getBookById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        _count: { select: { issues: true } },
      },
    });

    if (!book) {
      throw new NotFoundError("Book");
    }

    if (!isSuperAdmin && schoolId && book.schoolId !== schoolId) {
      throw new TenantError();
    }

    return book;
  },

  async updateBook(
    id: string,
    schoolId: string | undefined,
    data: Partial<CreateBookData>,
    isSuperAdmin = false
  ) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      throw new NotFoundError("Book");
    }
    if (!isSuperAdmin && schoolId && book.schoolId !== schoolId) {
      throw new TenantError();
    }

    return prisma.$transaction(async (tx) => {
      if (data.isbn) {
        const existing = await tx.book.findFirst({
          where: { schoolId: book.schoolId, isbn: data.isbn, id: { not: id } },
        });
        if (existing) {
          throw new ConflictError("A book with this ISBN already exists in the library");
        }
      }

      const totalCopies = data.totalCopies ?? book.totalCopies;
      const currentlyIssued = book.totalCopies - book.available;
      if (totalCopies < currentlyIssued) {
        throw new ConflictError(
          `Cannot reduce copies below the ${currentlyIssued} currently issued`
        );
      }

      const updated = await tx.book.update({
        where: { id },
        data: {
          title: data.title,
          author: data.author,
          isbn: data.isbn,
          publisher: data.publisher,
          category: data.category,
          edition: data.edition,
          totalCopies,
          available: totalCopies - currentlyIssued,
          rack: data.rack,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "BOOK",
          entityId: book.id,
          schoolId: book.schoolId,
          oldValue: { title: book.title },
          newValue: { title: updated.title },
        },
      });

      return updated;
    });
  },

  async deleteBook(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        issues: { where: { status: { not: "RETURNED" } } },
      },
    });

    if (!book) {
      throw new NotFoundError("Book");
    }
    if (!isSuperAdmin && schoolId && book.schoolId !== schoolId) {
      throw new TenantError();
    }
    if (book.issues.length > 0) {
      throw new ConflictError("Cannot delete a book that has active issues");
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "BOOK",
          entityId: book.id,
          schoolId: book.schoolId,
          oldValue: { title: book.title },
        },
      });
      await tx.book.delete({ where: { id: book.id } });
    });

    return { success: true };
  },

  async listBooks(query: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    schoolId?: string;
    isSuperAdmin?: boolean;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));

    if (!query.schoolId && !query.isSuperAdmin) {
      throw new TenantError("School context required");
    }

    const where: any = {};
    if (query.schoolId) {
      where.schoolId = query.schoolId;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { author: { contains: query.search, mode: "insensitive" } },
        { isbn: { contains: query.search, mode: "insensitive" } },
        { publisher: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { title: "asc" },
        include: {
          _count: {
            select: { issues: { where: { status: { not: "RETURNED" } } } },
          },
        },
      }),
    ]);

    return {
      data: books,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async listIssues(query: {
    page?: number;
    limit?: number;
    status?: string;
    studentId?: string;
    schoolId?: string;
    isSuperAdmin?: boolean;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));

    if (!query.schoolId && !query.isSuperAdmin) {
      throw new TenantError("School context required");
    }

    const where: any = {};
    if (query.schoolId) {
      where.schoolId = query.schoolId;
    }

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { not: "RETURNED" };
    }

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    const [total, issues] = await Promise.all([
      prisma.libraryIssue.count({ where }),
      prisma.libraryIssue.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issueDate: "desc" },
        include: {
          book: {
            select: { id: true, title: true, author: true, isbn: true, rack: true },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
            },
          },
        },
      }),
    ]);

    return {
      data: issues,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async issueBook(data: CreateIssueData, isSuperAdmin = false) {
    const book = await prisma.book.findUnique({ where: { id: data.bookId } });
    if (!book) {
      throw new NotFoundError("Book");
    }
    if (!isSuperAdmin && book.schoolId !== data.schoolId) {
      throw new TenantError();
    }
    if (book.available <= 0) {
      throw new ConflictError("No copies of this book are currently available");
    }

    const student = await prisma.student.findUnique({ where: { id: data.studentId } });
    if (!student) {
      throw new NotFoundError("Student");
    }
    if (!isSuperAdmin && student.schoolId !== data.schoolId) {
      throw new TenantError();
    }

    const activeIssue = await prisma.libraryIssue.findFirst({
      where: {
        bookId: data.bookId,
        studentId: data.studentId,
        status: { not: "RETURNED" },
      },
    });
    if (activeIssue) {
      throw new ConflictError("This student already has an active loan for this book");
    }

    const now = new Date();
    const dueDate = data.dueDate
      ? new Date(data.dueDate)
      : new Date(now.getTime() + DEFAULT_LOAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id: data.bookId },
        data: { available: { decrement: 1 } },
      });

      const issue = await tx.libraryIssue.create({
        data: {
          bookId: data.bookId,
          studentId: data.studentId,
          issueDate: now,
          dueDate,
          status: "ISSUED",
          fine: 0,
          schoolId: data.schoolId,
        },
        include: {
          book: { select: { id: true, title: true, author: true, rack: true } },
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNumber: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "LIBRARY_ISSUE",
          entityId: issue.id,
          schoolId: data.schoolId,
          newValue: {
            bookTitle: book.title,
            student: `${student.firstName} ${student.lastName}`,
            dueDate: dueDate.toISOString(),
          },
        },
      });

      return issue;
    });
  },

  async returnBook(issueId: string, schoolId: string | undefined, fine?: number, isSuperAdmin = false) {
    const issue = await prisma.libraryIssue.findUnique({
      where: { id: issueId },
      include: { book: { select: { id: true, title: true, schoolId: true } } },
    });

    if (!issue) {
      throw new NotFoundError("Library issue");
    }
    if (!isSuperAdmin && schoolId && issue.schoolId !== schoolId) {
      throw new TenantError();
    }
    if (issue.status === "RETURNED") {
      throw new ConflictError("This book has already been returned");
    }

    return prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id: issue.bookId },
        data: { available: { increment: 1 } },
      });

      const updated = await tx.libraryIssue.update({
        where: { id: issueId },
        data: {
          status: "RETURNED",
          returnDate: new Date(),
          fine: fine ?? 0,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "LIBRARY_ISSUE",
          entityId: issue.id,
          schoolId: issue.schoolId,
          oldValue: { status: issue.status },
          newValue: { status: "RETURNED", fine: fine ?? 0 },
        },
      });

      return updated;
    });
  },

  async getDashboardStats(schoolId: string | undefined, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) {
      throw new TenantError("School context required");
    }
    const scope = schoolId ? { schoolId } : {};

    const totalBooks = await prisma.book.count({ where: scope });
    const totalAvailable = await prisma.book.aggregate({
      where: scope,
      _sum: { available: true },
    });
    const issued = await prisma.libraryIssue.count({
      where: { ...scope, status: "ISSUED" },
    });
    const overdue = await prisma.libraryIssue.count({
      where: { ...scope, status: "OVERDUE" },
    });
    const returned = await prisma.libraryIssue.count({
      where: { ...scope, status: "RETURNED" },
    });

    const categories = await prisma.book.groupBy({
      by: ["category"],
      where: {
        ...scope,
        category: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 6,
    });

    const recentIssues = await prisma.libraryIssue.findMany({
      where: { ...scope, status: { not: "RETURNED" } },
      orderBy: { issueDate: "desc" },
      take: 6,
      include: {
        book: { select: { id: true, title: true, author: true, rack: true } },
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
      },
    });

    const topBooks = await prisma.libraryIssue.groupBy({
      by: ["bookId"],
      where: scope,
      _count: { _all: true },
      orderBy: { _count: { bookId: "desc" } },
      take: 5,
    });

    const topBookIds = topBooks.map((t) => t.bookId);
    const topDetails = topBookIds.length
      ? await prisma.book.findMany({
          where: { id: { in: topBookIds } },
          select: { id: true, title: true, author: true },
        })
      : [];

    return {
      totalBooks,
      availableCopies: totalAvailable._sum.available ?? 0,
      issued,
      overdue,
      returned,
      activeLoans: issued + overdue,
      categories: categories.map((c) => ({ name: c.category, count: c._count._all })),
      recentIssues,
      topBooks: topDetails,
    };
  },
};