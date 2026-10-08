import { prisma } from "../config/database";
import {
  AppError,
  ConflictError,
  NotFoundError,
  TenantError,
} from "../utils/errors";
import {
  academicYearLabel,
  academicYearMonths,
  feeMonthLabel,
  invoiceBalance,
  monthlyDueDate,
  resolveInvoiceStatus,
  roundMoney,
} from "../utils/fees";

type FeeType = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL";

interface StructureCreateData {
  schoolId: string;
  name: string;
  amount: number;
  feeCategoryId: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  studentId?: string;
  feeType?: FeeType;
  dueDate?: string;
  isRecurring?: boolean;
  recurringType?: string;
}

interface GenerateInvoicesData {
  schoolId: string;
  academicYearId: string;
  structureIds?: string[];
  classId?: string;
  sectionId?: string;
  studentIds?: string[];
  feeMonths?: number[];
  feeYear?: number;
}

interface CreatePaymentData {
  invoiceId: string;
  amount: number;
  method:
    | "CASH"
    | "UPI"
    | "BANK_TRANSFER"
    | "CARD"
    | "ONLINE"
    | "RAZORPAY"
    | "STRIPE"
    | "CHEQUE"
    | "OTHER";
  transactionId?: string;
  receivedBy?: string;
  schoolId: string;
}

const sortByMonthDesc = (
  a: { feeMonth: number | null; feeYear: number | null },
  b: { feeMonth: number | null; feeYear: number | null }
) => {
  const ay = (a.feeYear || 0) * 100 + (a.feeMonth || 0);
  const by = (b.feeYear || 0) * 100 + (b.feeMonth || 0);
  return by - ay;
};

const quarterMonths = (startYear: number): { feeMonth: number; feeYear: number }[] => [
  { feeMonth: 4, feeYear: startYear },
  { feeMonth: 7, feeYear: startYear },
  { feeMonth: 10, feeYear: startYear },
  { feeMonth: 1, feeYear: startYear + 1 },
];

const halfYearMonths = (startYear: number): { feeMonth: number; feeYear: number }[] => [
  { feeMonth: 4, feeYear: startYear },
  { feeMonth: 10, feeYear: startYear },
];

export const feeService = {
  // ================================================================
  // ACADEMIC YEARS (April → March)
  // ================================================================
  async listAcademicYears(schoolId: string | undefined, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) throw new TenantError("School context required");
    return prisma.academicYear.findMany({
      where: schoolId ? { schoolId } : {},
      include: {
        _count: { select: { classes: true, invoices: true } },
      },
      orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    });
  },

  async createAcademicYear(data: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate?: string;
    isCurrent?: boolean;
    status?: string;
  }) {
    const start = new Date(data.startDate);
    const end = data.endDate ? new Date(data.endDate) : new Date(start.getFullYear() + 1, 2, 31);

    const valid =
      start.getMonth() === 3 &&
      start.getDate() === 1 &&
      end.getMonth() === 2 &&
      end.getDate() === 31 &&
      end.getFullYear() === start.getFullYear() + 1;

    if (!valid) {
      throw new AppError(
        "Academic year must run from April 1 to March 31 of the following year",
        400,
        "INVALID_ACADEMIC_YEAR"
      );
    }

    const name =
      data.name || `AY ${start.getFullYear()}-${String(start.getFullYear() + 1).slice(2)}`;

    const existing = await prisma.academicYear.findUnique({
      where: { schoolId_name: { schoolId: data.schoolId, name } },
    });
    if (existing) throw new ConflictError(`Academic year "${name}" already exists for this school`);

    return prisma.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId: data.schoolId },
          data: { isCurrent: false },
        });
      }
      const year = await tx.academicYear.create({
        data: {
          name,
          startDate: start,
          endDate: end,
          schoolId: data.schoolId,
          status: data.status || "ACTIVE",
          isCurrent: data.isCurrent ?? false,
        },
      });
      return year;
    });
  },

  async updateAcademicYear(
    id: string,
    schoolId: string,
    data: {
      name?: string;
      startDate?: string;
      endDate?: string;
      isCurrent?: boolean;
      status?: string;
    }
  ) {
    const year = await prisma.academicYear.findUnique({ where: { id } });
    if (!year || year.schoolId !== schoolId) throw new NotFoundError("Academic year");

    const update: any = {};
    const start = data.startDate ? new Date(data.startDate) : undefined;
    const end = data.endDate ? new Date(data.endDate) : undefined;

    if (start) {
      if (start.getMonth() !== 3 || start.getDate() !== 1) {
        throw new AppError("Academic year must start on April 1", 400, "INVALID_ACADEMIC_YEAR");
      }
      update.startDate = start;
    }
    if (end) {
      if (end.getMonth() !== 2 || end.getDate() !== 31) {
        throw new AppError("Academic year must end on March 31", 400, "INVALID_ACADEMIC_YEAR");
      }
      update.endDate = end;
    }
    if (data.name) update.name = data.name;
    if (data.status) update.status = data.status;

    return prisma.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId },
          data: { isCurrent: false },
        });
        update.isCurrent = true;
      } else if (data.isCurrent === false) {
        update.isCurrent = false;
      }
      const updated = await tx.academicYear.update({ where: { id }, data: update });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "ACADEMIC_YEAR",
          entityId: id,
          schoolId,
          newValue: update,
        },
      });
      return updated;
    });
  },

  // ================================================================
  // FEE STRUCTURES
  // ================================================================
  async listCategories(schoolId: string | undefined, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) throw new TenantError("School context required");
    return prisma.feeCategory.findMany({
      where: schoolId ? { schoolId } : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, _count: { select: { structures: true } } },
    });
  },

  async listStructures(
    schoolId: string | undefined,
    isSuperAdmin = false,
    filters: {
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
      feeType?: string;
    } = {}
  ) {
    if (!schoolId && !isSuperAdmin) throw new TenantError("School context required");
    const where: any = schoolId ? { schoolId } : {};
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.classId) where.classId = filters.classId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.feeType) where.feeType = filters.feeType;

    const [structures, categories] = await Promise.all([
      prisma.feeStructure.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        include: {
          feeCategory: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          _count: { select: { invoices: true } },
        },
      }),
      feeService.listCategories(schoolId, isSuperAdmin),
    ]);

    return { data: structures, categories };
  },

  async createStructure(data: StructureCreateData) {
    const amount = roundMoney(Number(data.amount));
    if (amount <= 0) {
      throw new AppError("Fee amount must be greater than zero", 400, "VALIDATION_ERROR");
    }

    const feeCategory = await prisma.feeCategory.findFirst({
      where: { id: data.feeCategoryId, schoolId: data.schoolId },
    });
    if (!feeCategory) throw new NotFoundError("Fee category");

    let classId = data.classId;
    let sectionId = data.sectionId;
    let studentId = data.studentId;

    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId: data.schoolId },
      });
      if (!student) throw new TenantError("Student does not belong to this school");
      classId = classId || student.classId;
      sectionId = sectionId || student.sectionId || undefined;
    }

    if (sectionId) {
      const section = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!section) throw new NotFoundError("Section");
      if (classId && section.classId !== classId) {
        throw new AppError("Section does not belong to the selected class", 400, "VALIDATION_ERROR");
      }
      classId = section.classId;
    }

    const structure = await prisma.feeStructure.create({
      data: {
        name: data.name,
        amount,
        feeCategoryId: data.feeCategoryId,
        schoolId: data.schoolId,
        classId,
        sectionId,
        studentId,
        academicYearId: data.academicYearId,
        feeType: data.feeType || "MONTHLY",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isRecurring: data.isRecurring ?? data.feeType === "MONTHLY",
        recurringType: data.recurringType,
      },
      include: {
        feeCategory: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "FEE_STRUCTURE",
        entityId: structure.id,
        schoolId: data.schoolId,
        newValue: { name: structure.name, amount },
      },
    });

    return structure;
  },

  async updateStructure(
    id: string,
    schoolId: string,
    data: Partial<StructureCreateData>
  ) {
    const structure = await prisma.feeStructure.findUnique({ where: { id } });
    if (!structure || structure.schoolId !== schoolId) {
      throw new TenantError("Fee structure not found");
    }

    if (data.academicYearId && structure.academicYearId !== data.academicYearId) {
      const invoiceCount = await prisma.invoice.count({ where: { feeStructureId: id } });
      if (invoiceCount > 0) {
        throw new AppError(
          "Cannot change the academic year of a structure that already has invoices",
          400,
          "CONFLICT"
        );
      }
    }

    let classId = data.classId ?? structure.classId ?? null;
    let sectionId = data.sectionId ?? structure.sectionId ?? null;
    let studentId = data.studentId ?? structure.studentId ?? null;

    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId },
      });
      if (!student) throw new TenantError("Student does not belong to this school");
      classId = classId || student.classId;
      sectionId = sectionId || student.sectionId || null;
    }
    if (sectionId) {
      const section = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!section) throw new NotFoundError("Section");
      if (classId && section.classId !== classId) {
        throw new AppError("Section does not belong to the selected class", 400, "VALIDATION_ERROR");
      }
      classId = section.classId;
    }

    const updated = await prisma.feeStructure.update({
      where: { id },
      data: {
        name: data.name,
        amount: data.amount !== undefined ? roundMoney(Number(data.amount)) : undefined,
        feeCategoryId: data.feeCategoryId,
        classId,
        sectionId,
        studentId,
        academicYearId: data.academicYearId,
        feeType: data.feeType,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        isRecurring: data.isRecurring,
        recurringType: data.recurringType,
      },
      include: {
        feeCategory: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "FEE_STRUCTURE",
        entityId: id,
        schoolId,
        newValue: data,
      },
    });
    return updated;
  },

  async deleteStructure(id: string, schoolId: string) {
    const structure = await prisma.feeStructure.findUnique({ where: { id } });
    if (!structure || structure.schoolId !== schoolId) {
      throw new TenantError("Fee structure not found");
    }
    const invoiceCount = await prisma.invoice.count({ where: { feeStructureId: id } });
    if (invoiceCount > 0) {
      throw new AppError(
        "Cannot delete a fee structure that has invoices. Deactivate it instead.",
        400,
        "CONFLICT"
      );
    }
    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "FEE_STRUCTURE",
        entityId: id,
        schoolId,
        oldValue: { name: structure.name },
      },
    });
    await prisma.feeStructure.delete({ where: { id } });
    return { id };
  },

  // ================================================================
  // INVOICE NUMBERS — INV/2026-27/000001 (never duplicated)
  // ================================================================
  async nextInvoiceNumbers(schoolId: string, academicYearId: string, count: number) {
    if (count <= 0) return [];

    return prisma.$transaction(async (tx) => {
      const seq = await tx.invoiceSequence.upsert({
        where: { schoolId_academicYearId: { schoolId, academicYearId } },
        update: { sequence: { increment: count } },
        create: { schoolId, academicYearId, sequence: count },
      });

      const year = await tx.academicYear.findUnique({
        where: { id: academicYearId },
        select: { startDate: true, endDate: true },
      });
      const label = year
        ? academicYearLabel(year.startDate, year.endDate)
        : `${new Date().getFullYear()}`;

      const start = seq.sequence - count + 1;
      const numbers: string[] = [];
      for (let i = start; i <= seq.sequence; i++) {
        numbers.push(`INV/${label}/${String(i).padStart(6, "0")}`);
      }
      return numbers;
    });
  },

  resolveInvoiceNumbers(
    numbers: string[],
    existing: { invoiceNumber: string }[],
    fallbackPrefix: string
  ) {
    const used = new Set(existing.map((i) => i.invoiceNumber));
    const result: string[] = [];
    let seq = 1;
    for (const num of numbers) {
      if (!used.has(num)) {
        result.push(num);
      } else {
        while (used.has(`${fallbackPrefix}/${String(seq).padStart(6, "0")}`)) seq++;
        const alt = `${fallbackPrefix}/${String(seq).padStart(6, "0")}`;
        used.add(alt);
        result.push(alt);
      }
    }
    return result;
  },

  // ================================================================
  // MONTHLY / QUARTERLY / ANNUAL FEE GENERATION
  // ================================================================
  async generateInvoices(data: GenerateInvoicesData) {
    const year = await prisma.academicYear.findUnique({ where: { id: data.academicYearId } });
    if (!year || year.schoolId !== data.schoolId) throw new NotFoundError("Academic year");

    const structures = await prisma.feeStructure.findMany({
      where: {
        schoolId: data.schoolId,
        academicYearId: year.id,
        ...(data.structureIds?.length ? { id: { in: data.structureIds } } : {}),
      },
      include: {
        student: { select: { id: true, classId: true, sectionId: true } },
      },
    });

    if (structures.length === 0) {
      throw new AppError(
        "No fee structures found for the selected academic year",
        400,
        "NO_FEE_STRUCTURE"
      );
    }

    const created: any[] = [];
    let skipped = 0;
    let invoiceNumbersToAllocate = 0;

    interface Plan {
      structure: (typeof structures)[number];
      studentId: string;
      feeMonth: number;
      feeYear: number;
      dueDate: Date;
      description: string;
    }
    const plans: Plan[] = [];

    const existing = await prisma.invoice.findMany({
      where: {
        schoolId: data.schoolId,
        feeStructureId: { in: structures.map((s) => s.id) },
      },
      select: { studentId: true, feeStructureId: true, feeMonth: true, feeYear: true },
      take: 100000,
    });
    const existingKey = new Set(
      existing.map((e) => `${e.studentId}:${e.feeStructureId}:${e.feeMonth}:${e.feeYear}`)
    );

    for (const structure of structures) {
      const type = structure.feeType as FeeType;

      let months: { feeMonth: number; feeYear: number }[] = [];
      if (data.feeMonths?.length) {
        const fy = data.feeYear ?? year.startDate.getFullYear();
        months = data.feeMonths.map((m) => ({ feeMonth: m, feeYear: fy }));
      } else {
        const startYear = year.startDate.getFullYear();
        if (type === "QUARTERLY") months = quarterMonths(startYear);
        else if (type === "HALF_YEARLY") months = halfYearMonths(startYear);
        else if (type === "ANNUAL") months = [{ feeMonth: 4, feeYear: startYear }];
        else months = academicYearMonths(year.startDate, year.endDate);
      }

      const students = await this.resolveStructureStudents(data, structure);
      for (const studentId of students) {
        for (const { feeMonth, feeYear } of months) {
          const dedupeKey = `${studentId}:${structure.id}:${feeMonth}:${feeYear}`;
          if (existingKey.has(dedupeKey)) {
            skipped++;
            continue;
          }
          existingKey.add(dedupeKey);
          const dueDate =
            structure.feeType !== "MONTHLY" && structure.dueDate
              ? new Date(structure.dueDate)
              : monthlyDueDate(feeMonth, feeYear);
          const period =
            structure.feeType === "MONTHLY" ? feeMonthLabel(feeMonth, feeYear) : structure.name;
          plans.push({
            structure,
            studentId,
            feeMonth,
            feeYear,
            dueDate,
            description: `${period} ${structure.name} Fee`,
          });
        }
      }
    }

    if (plans.length === 0) {
      return { created: [], skipped, message: "All invoices already generated for the selection" };
    }

    invoiceNumbersToAllocate = plans.length;
    const numbers = await this.nextInvoiceNumbers(data.schoolId, data.academicYearId, invoiceNumbersToAllocate);

    // Replace any numbers that already exist (e.g. seeded or raced invoices)
    // with fresh fallback numbers within the same prefix.
    const taken = await prisma.invoice.findMany({
      where: { schoolId: data.schoolId, invoiceNumber: { in: numbers } },
      select: { invoiceNumber: true },
    });
    const safeNumbers = this.resolveInvoiceNumbers(numbers, taken, `INV/${academicYearLabel(year.startDate, year.endDate)}`);

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < plans.length; i++) {
        const plan = plans[i];
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: safeNumbers[i],
            studentId: plan.studentId,
            feeStructureId: plan.structure.id,
            academicYearId: data.academicYearId,
            schoolId: data.schoolId,
            totalAmount: plan.structure.amount,
            feeMonth: plan.feeMonth,
            feeYear: plan.feeYear,
            dueDate: plan.dueDate,
            status: "PENDING",
            items: {
              create: [
                {
                  feeCategoryId: plan.structure.feeCategoryId,
                  description: plan.description,
                  amount: plan.structure.amount,
                },
              ],
            },
          },
        });
        created.push({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          studentId: plan.studentId,
          feeMonth: plan.feeMonth,
          feeYear: plan.feeYear,
          amount: Number(plan.structure.amount),
          dueDate: plan.dueDate,
        });
      }
    });

    return { created, skipped, count: created.length };
  },

  async createInvoice(input: {
    schoolId: string;
    studentId: string;
    amount: number;
    description?: string;
    feeCategoryId?: string;
    discount?: number;
    fine?: number;
    dueDate?: string;
    feeMonth?: number;
    feeYear?: number;
    feeStructureId?: string;
    academicYearId?: string;
  }) {
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { schoolId: true },
    });
    if (!student) throw new NotFoundError("Student");
    if (student.schoolId !== input.schoolId) throw new TenantError();

    const academicYearId =
      input.academicYearId ||
      (
        await prisma.academicYear.findFirst({
          where: { schoolId: input.schoolId, isCurrent: true },
          select: { id: true },
        })
      )?.id;

    const [number] = academicYearId
      ? await this.nextInvoiceNumbers(input.schoolId, academicYearId, 1)
      : [`INV/${new Date().getFullYear()}-${new Date().getFullYear() + 1}/${String(Date.now()).slice(-6)}`];

    const amount = roundMoney(input.amount);
    const discount = roundMoney(input.discount || 0);
    const fine = roundMoney(input.fine || 0);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: number,
        studentId: input.studentId,
        feeStructureId: input.feeStructureId,
        academicYearId,
        schoolId: input.schoolId,
        totalAmount: amount,
        discount,
        fine,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        feeMonth: input.feeMonth,
        feeYear: input.feeYear,
        status: "PENDING",
        items: input.feeCategoryId
          ? {
              create: [
                {
                  feeCategoryId: input.feeCategoryId,
                  description: input.description || "Fee",
                  amount,
                },
              ],
            }
          : undefined,
      },
      include: {
        student: { include: { class: true, section: true } },
        items: true,
      },
    });
    return invoice;
  },

  async resolveStructureStudents(
    data: GenerateInvoicesData,
    structure: { studentId: string | null; classId: string | null; sectionId: string | null }
  ): Promise<string[]> {
    let students: {
      id: string;
      classId: string;
      sectionId: string | null;
      status: string;
    }[] = [];

    if (data.studentIds?.length) {
      students = await prisma.student.findMany({
        where: {
          id: { in: data.studentIds },
          schoolId: data.schoolId,
          status: "ACTIVE",
          ...(data.classId ? { classId: data.classId } : {}),
          ...(data.sectionId ? { sectionId: data.sectionId } : {}),
        },
        select: { id: true, classId: true, sectionId: true, status: true },
      });
    } else if (structure.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: structure.studentId, schoolId: data.schoolId, status: "ACTIVE" },
        select: { id: true, classId: true, sectionId: true, status: true },
      });
      if (student) students = [student];
    } else if (structure.classId) {
      students = await prisma.student.findMany({
        where: {
          schoolId: data.schoolId,
          status: "ACTIVE",
          classId: structure.classId,
          ...(structure.sectionId ? { sectionId: structure.sectionId } : {}),
          ...(data.classId ? { classId: data.classId } : {}),
          ...(data.sectionId ? { sectionId: data.sectionId } : {}),
        },
        select: { id: true, classId: true, sectionId: true, status: true },
      });
    } else {
      students = await prisma.student.findMany({
        where: {
          schoolId: data.schoolId,
          status: "ACTIVE",
          ...(data.classId ? { classId: data.classId } : {}),
          ...(data.sectionId ? { sectionId: data.sectionId } : {}),
        },
        select: { id: true, classId: true, sectionId: true, status: true },
      });
    }

    return students.map((s) => s.id);
  },

  // ================================================================
  // OVERDUE REFRESH
  // ================================================================
  async refreshOverdueInvoices(schoolId: string | undefined, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) throw new TenantError("School context required");
    const where: any = { status: "PENDING", dueDate: { lt: new Date() } };
    if (schoolId) where.schoolId = schoolId;
    const result = await prisma.invoice.updateMany({
      where,
      data: { status: "OVERDUE" },
    });
    return result.count;
  },

  // ================================================================
  // INVOICE LISTS & DETAILS
  // ================================================================
  async listInvoices(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    schoolId?: string;
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    studentId?: string;
    feeMonth?: number;
    isSuperAdmin?: boolean;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 15));

    if (!query.schoolId && !query.isSuperAdmin) throw new TenantError("School context required");

    await this.refreshOverdueInvoices(query.schoolId, query.isSuperAdmin);

    const where: any = {};
    if (query.schoolId) where.schoolId = query.schoolId;
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (query.studentId) where.studentId = query.studentId;
    if (query.feeMonth) where.feeMonth = query.feeMonth;
    if (query.status) where.status = query.status;

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: "insensitive" } },
        { student: { firstName: { contains: query.search, mode: "insensitive" } } },
        { student: { lastName: { contains: query.search, mode: "insensitive" } } },
        { student: { admissionNumber: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    if (query.classId || query.sectionId) {
      where.student = {
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      };
    }

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ feeYear: "desc" }, { feeMonth: "desc" }, { createdAt: "desc" }],
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              rollNumber: true,
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
          school: { select: { id: true, name: true } },
          feeStructure: {
            select: { id: true, name: true, feeType: true },
          },
          academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
          _count: { select: { payments: true, fineHistories: true } },
        },
      }),
    ]);

    const rows = invoices.map((inv) => {
      const total = Number(inv.totalAmount);
      const paid = Number(inv.paidAmount);
      const discount = Number(inv.discount);
      const fine = Number(inv.fine);
      return {
        ...inv,
        totalAmount: total,
        paidAmount: paid,
        discount,
        fine,
        balance: invoiceBalance(total, paid, discount, fine),
        finalAmount: roundMoney(total + fine - discount),
        feeMonthLabel:
          inv.feeMonth && inv.feeYear ? feeMonthLabel(inv.feeMonth, inv.feeYear) : null,
      };
    });

    return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  async getInvoiceById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            studentId: true,
            rollNumber: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
            parents: { include: { parent: true } },
          },
        },
        school: true,
        feeStructure: {
          select: { id: true, name: true, feeType: true },
        },
        academicYear: true,
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
        fineHistories: { orderBy: { createdAt: "desc" } },
        deliveries: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!invoice) throw new NotFoundError("Invoice");
    if (!isSuperAdmin && invoice.schoolId !== schoolId) throw new TenantError();

    const total = Number(invoice.totalAmount);
    const paid = Number(invoice.paidAmount);
    const discount = Number(invoice.discount);
    const fine = Number(invoice.fine);
    const balance = invoiceBalance(total, paid, discount, fine);

    let previousPending = 0;
    if (invoice.studentId) {
      const others = await prisma.invoice.findMany({
        where: {
          studentId: invoice.studentId,
          id: { not: invoice.id },
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        },
        select: { totalAmount: true, paidAmount: true, discount: true, fine: true },
      });
      previousPending = others.reduce(
        (sum, o) =>
          sum +
          invoiceBalance(
            Number(o.totalAmount),
            Number(o.paidAmount),
            Number(o.discount),
            Number(o.fine)
          ),
        0
      );
    }

    return {
      ...invoice,
      totalAmount: total,
      paidAmount: paid,
      discount,
      fine,
      balance,
      previousPending,
      finalAmount: roundMoney(total + fine - discount),
      feeMonthLabel:
        invoice.feeMonth && invoice.feeYear ? feeMonthLabel(invoice.feeMonth, invoice.feeYear) : null,
    };
  },

  // ================================================================
  // FINE MANAGEMENT (full fine, reduced, partial waiver, full waiver)
  // ================================================================
  async applyFine(invoiceId: string, schoolId: string, fine: number, reason: string | undefined, adjustedBy: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.schoolId !== schoolId) throw new TenantError("Invoice not found");
    if (invoice.status === "PAID") {
      throw new AppError("Fine cannot be applied to a paid invoice", 400, "INVOICE_PAID");
    }

    const newFine = roundMoney(Math.max(0, Number(fine)));
    const previousFine = Number(invoice.fine);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { fine: newFine },
      });

      const history = await tx.fineHistory.create({
        data: {
          invoiceId,
          previousFine,
          newFine,
          reason: reason || null,
          adjustedBy,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adjustedBy,
          action: "UPDATE",
          entity: "FINE",
          entityId: invoiceId,
          schoolId,
          oldValue: { fine: previousFine },
          newValue: { fine: newFine, reason },
        },
      });

      return { history, invoice: updated, previousFine, newFine };
    });
  },

  // ================================================================
  // PAYMENTS
  // ================================================================
  async collectPayment(data: CreatePaymentData) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: data.invoiceId },
        include: { payments: true },
      });

      if (!invoice) throw new NotFoundError("Invoice");
      if (invoice.schoolId !== data.schoolId) {
        throw new TenantError("Invoice does not belong to this school");
      }

      if (data.transactionId) {
        const dup = await tx.payment.findFirst({
          where: { schoolId: data.schoolId, transactionId: data.transactionId },
        });
        if (dup) {
          throw new ConflictError(`Transaction ${data.transactionId} has already been recorded`);
        }
      }

      const alreadyPaid = Number(invoice.paidAmount);
      const total = Number(invoice.totalAmount);
      const discount = Number(invoice.discount);
      const fine = Number(invoice.fine);
      const remaining = roundMoney(total + fine - discount - alreadyPaid);

      if (data.amount <= 0) {
        throw new AppError("Payment amount must be greater than zero", 400, "INVALID_PAYMENT_AMOUNT");
      }
      if (data.amount > remaining + 0.01) {
        throw new AppError(
          `Payment exceeds outstanding balance of ${remaining.toFixed(2)}`,
          400,
          "INVALID_PAYMENT_AMOUNT"
        );
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: data.amount,
          method: data.method,
          transactionId: data.transactionId,
          receivedBy: data.receivedBy,
          status: "COMPLETED",
          schoolId: data.schoolId,
        },
      });

      const newPaid = roundMoney(alreadyPaid + data.amount);
      const newStatus = resolveInvoiceStatus(total, newPaid, discount, fine, invoice.dueDate);
      const paidAt = newStatus === "PAID" ? new Date() : invoice.paidAt;

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          paidAt,
          status: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: data.receivedBy,
          action: "PAYMENT",
          entity: "INVOICE",
          entityId: invoice.id,
          schoolId: data.schoolId,
          newValue: { amount: data.amount, method: data.method, transactionId: data.transactionId },
        },
      });

      return {
        payment,
        invoice: {
          ...updated,
          totalAmount: total,
          balance: roundMoney(remaining - data.amount),
        },
      };
    });
  },

  async getStudentHistory(studentId: string, schoolId: string | undefined, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) throw new TenantError("School context required");

    const student = await prisma.student.findFirst({
      where: { id: studentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        rollNumber: true,
        schoolId: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
        parents: { include: { parent: true } },
      },
    });
    if (!student) throw new NotFoundError("Student");
    if (!isSuperAdmin && student.schoolId !== schoolId) throw new TenantError();

    const invoices = await prisma.invoice.findMany({
      where: { studentId },
      orderBy: [{ feeYear: "asc" }, { feeMonth: "asc" }],
      include: {
        payments: { orderBy: { paidAt: "desc" } },
        feeStructure: { select: { name: true, feeType: true } },
        fineHistories: { orderBy: { createdAt: "desc" } },
        deliveries: true,
      },
    });

    const rows = invoices.map((inv) => {
      const total = Number(inv.totalAmount);
      const paid = Number(inv.paidAmount);
      const discount = Number(inv.discount);
      const fine = Number(inv.fine);
      return {
        ...inv,
        totalAmount: total,
        paidAmount: paid,
        discount,
        fine,
        balance: invoiceBalance(total, paid, discount, fine),
        finalAmount: roundMoney(total + fine - discount),
        feeMonthLabel:
          inv.feeMonth && inv.feeYear ? feeMonthLabel(inv.feeMonth, inv.feeYear) : null,
      };
    });

    return { student, rows: rows.sort(sortByMonthDesc) };
  },

  // ================================================================
  // PENDING FEE REPORT
  // ================================================================
  async getPendingReport(query: {
    schoolId?: string;
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    studentId?: string;
    feeMonth?: number;
    feeType?: string;
    status?: string;
    search?: string;
    isSuperAdmin?: boolean;
  }) {
    if (!query.schoolId && !query.isSuperAdmin) throw new TenantError("School context required");
    await this.refreshOverdueInvoices(query.schoolId, query.isSuperAdmin);

    const where: any = {};
    if (query.schoolId) where.schoolId = query.schoolId;
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (query.studentId) where.studentId = query.studentId;
    if (query.feeMonth) where.feeMonth = query.feeMonth;
    if (query.status) where.status = query.status;
    if (query.feeType) where.feeStructure = { feeType: query.feeType };

    if (query.classId || query.sectionId) {
      where.student = {
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: "insensitive" } },
        { student: { firstName: { contains: query.search, mode: "insensitive" } } },
        { student: { lastName: { contains: query.search, mode: "insensitive" } } },
        { student: { admissionNumber: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: [
        { student: { classId: "asc" } },
        { feeYear: "desc" },
        { feeMonth: "desc" },
      ],
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            rollNumber: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
            parents: {
              include: {
                parent: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
              },
            },
          },
        },
        feeStructure: { select: { id: true, name: true, feeType: true } },
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
      take: 5000,
    });

    const rows = invoices
      .map((inv) => {
        const total = Number(inv.totalAmount);
        const paid = Number(inv.paidAmount);
        const discount = Number(inv.discount);
        const fine = Number(inv.fine);
        const balance = invoiceBalance(total, paid, discount, fine);
        const parent = inv.student.parents[0]?.parent;
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          studentId: inv.student.id,
          studentName: `${inv.student.firstName} ${inv.student.lastName}`,
          admissionNumber: inv.student.admissionNumber,
          rollNumber: inv.student.rollNumber,
          className: inv.student.class?.name || "—",
          sectionName: inv.student.section?.name || "—",
          parentName: parent ? `${parent.firstName} ${parent.lastName}` : "—",
          parentPhone: parent?.phone || null,
          parentEmail: parent?.email || null,
          feeMonth: inv.feeMonth,
          feeYear: inv.feeYear,
          feeMonthLabel: inv.feeMonth && inv.feeYear ? feeMonthLabel(inv.feeMonth, inv.feeYear) : (inv.feeStructure?.name || ""),
          feeType: inv.feeStructure?.feeType || null,
          totalFee: total,
          paidAmount: paid,
          fine,
          discount,
          pending: Math.max(0, balance),
          dueDate: inv.dueDate,
          status: inv.status as string,
        };
      })
      .filter((r) => query.status || r.pending > 0 || (!query.status && true));

    const totalFee = rows.reduce((s, r) => s + r.totalFee, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paidAmount, 0);
    const totalFine = rows.reduce((s, r) => s + r.fine, 0);
    const totalDiscount = rows.reduce((s, r) => s + r.discount, 0);
    const totalPending = rows.reduce((s, r) => s + r.pending, 0);

    const statusCounts = {
      PAID: rows.filter((r) => r.status === "PAID").length,
      PARTIAL: rows.filter((r) => r.status === "PARTIAL").length,
      PENDING: rows.filter((r) => r.status === "PENDING").length,
      OVERDUE: rows.filter((r) => r.status === "OVERDUE").length,
    };
    const uniqueStudents = new Set(rows.map((r) => r.studentId));

    const summary = {
      totalStudents: uniqueStudents.size,
      totalRecords: rows.length,
      statusCounts,
      totalFee: roundMoney(totalFee),
      totalPaid: roundMoney(totalPaid),
      totalFine: roundMoney(totalFine),
      totalDiscount: roundMoney(totalDiscount),
      totalPending: roundMoney(totalPending),
    };

    const classSectionKey = new Map<string, any>();
    for (const r of rows) {
      const key = `${r.className}|${r.sectionName}`;
      const entry =
        classSectionKey.get(key) ||
        {
          className: r.className,
          sectionName: r.sectionName,
          totalStudents: 0,
          paidStudents: 0,
          pendingStudents: 0,
          partialStudents: 0,
          totalFee: 0,
          totalPaid: 0,
          totalFine: 0,
          totalDiscount: 0,
          totalPending: 0,
          studentIds: new Set<string>(),
        };
      entry.totalFee += r.totalFee;
      entry.totalPaid += r.paidAmount;
      entry.totalFine += r.fine;
      entry.totalDiscount += r.discount;
      entry.totalPending += r.pending;
      entry.studentIds.add(r.studentId);
      if (r.status === "PAID") entry.paidStudents++;
      else if (r.status === "PARTIAL") entry.partialStudents++;
      else entry.pendingStudents++;
      classSectionKey.set(key, entry);
    }

    const classSummary = Array.from(classSectionKey.values())
      .map((e) => ({
        className: e.className,
        sectionName: e.sectionName,
        totalStudents: e.studentIds.size,
        paidStudents: e.paidStudents,
        partialStudents: e.partialStudents,
        pendingStudents: e.pendingStudents,
        totalFee: roundMoney(e.totalFee),
        totalPaid: roundMoney(e.totalPaid),
        totalFine: roundMoney(e.totalFine),
        totalDiscount: roundMoney(e.totalDiscount),
        totalPending: roundMoney(e.totalPending),
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    return { rows, summary, classSummary };
  },

  async getReportSchool(schoolId: string | undefined) {
    if (!schoolId) {
      return { name: "School", email: "", phone: "", address: "", website: "" };
    }
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, email: true, phone: true, address: true, website: true, logo: true, city: true, state: true },
    });
    if (!school) throw new NotFoundError("School");
    return {
      name: school.name,
      email: school.email,
      phone: school.phone ?? undefined,
      address: `${school.address || ""}${school.city ? `, ${school.city}` : ""}${school.state ? `, ${school.state}` : ""}`,
      website: undefined,
      logo: school.logo,
    };
  },

  async getReportYear(academicYearId: string | undefined) {
    if (!academicYearId) return null;
    const year = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { name: true, startDate: true, endDate: true },
    });
    if (!year) throw new NotFoundError("Academic year");
    return { name: year.name, label: academicYearLabel(year.startDate, year.endDate) };
  },

  // ================================================================
  // DASHBOARD
  // ================================================================
  async getDashboardStats(
    schoolId: string | undefined,
    isSuperAdmin = false,
    academicYearId?: string
  ) {
    if (!schoolId && !isSuperAdmin) throw new TenantError("School context required");
    await this.refreshOverdueInvoices(schoolId, isSuperAdmin);

    const ay = academicYearId
      ? await prisma.academicYear.findUnique({ where: { id: academicYearId } })
      : schoolId
        ? await prisma.academicYear.findFirst({
            where: { schoolId, isCurrent: true },
          })
        : null;

    const invoiceWhere: any = schoolId ? { schoolId } : {};
    if (ay) invoiceWhere.academicYearId = ay.id;

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true,
          studentId: true,
          totalAmount: true,
          paidAmount: true,
          discount: true,
          fine: true,
          status: true,
          dueDate: true,
          feeMonth: true,
          feeYear: true,
          student: { select: { class: { select: { name: true } }, section: { select: { name: true } } } },
        },
      }),
      prisma.payment.findMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          ...(ay ? { invoice: { academicYearId: ay.id } } : {}),
        },
        select: { amount: true, paidAt: true },
      }),
    ]);

    const totalExpected = invoices.reduce(
      (s, i) => s + roundMoney(Number(i.totalAmount) + Number(i.fine) - Number(i.discount)),
      0
    );
    const totalCollected = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
    const totalPending = roundMoney(Math.max(0, totalExpected - totalCollected));
    const totalFines = invoices.reduce((s, i) => s + Number(i.fine), 0);
    const totalDiscounts = invoices.reduce((s, i) => s + Number(i.discount), 0);

    const paidStatuses = new Set(invoices.filter((i) => i.status === "PAID").map((i) => i.studentId));
    const partialStatuses = new Set(invoices.filter((i) => i.status === "PARTIAL").map((i) => i.studentId));
    const pendingStatuses = new Set(
      invoices
        .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
        .map((i) => i.studentId)
    );

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayCollection = payments
      .filter((p) => p.paidAt >= todayStart)
      .reduce((s, p) => s + Number(p.amount), 0);
    const monthCollection = payments
      .filter((p) => p.paidAt >= monthStart)
      .reduce((s, p) => s + Number(p.amount), 0);

    const months = ay ? academicYearMonths(ay.startDate, ay.endDate) : [];
    const monthlyCollection = months.map(({ feeMonth, feeYear }) => {
      const start = new Date(feeYear, feeMonth - 1, 1);
      const end = new Date(feeYear, feeMonth, 0, 23, 59, 59);
      const collected = payments
        .filter((p) => p.paidAt >= start && p.paidAt <= end)
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        month: `${MONTH_SHORT[feeMonth - 1]} ${feeYear}`,
        feeMonth,
        feeYear,
        collected: roundMoney(collected),
        expected: roundMoney(
          invoices
            .filter((i) => i.feeMonth === feeMonth && i.feeYear === feeYear)
            .reduce((s, i) => s + roundMoney(Number(i.totalAmount) + Number(i.fine) - Number(i.discount)), 0)
        ),
        pending: roundMoney(
          invoices
            .filter((i) => i.feeMonth === feeMonth && i.feeYear === feeYear)
            .reduce(
              (s, i) =>
                s +
                Math.max(
                  0,
                  roundMoney(
                    Number(i.totalAmount) + Number(i.fine) - Number(i.discount) - Number(i.paidAmount)
                  )
                ),
              0
            )
        ),
      };
    });

    const classMap = new Map<string, { className: string; collected: number; pending: number; expected: number }>();
    for (const inv of invoices) {
      const name = inv.student?.class?.name || "Unassigned";
      const entry =
        classMap.get(name) ||
        { className: name, collected: 0, pending: 0, expected: 0 };
      entry.expected += roundMoney(Number(inv.totalAmount) + Number(inv.fine) - Number(inv.discount));
      entry.collected += Number(inv.paidAmount);
      entry.pending += Math.max(
        0,
        roundMoney(
          Number(inv.totalAmount) + Number(inv.fine) - Number(inv.discount) - Number(inv.paidAmount)
        )
      );
      classMap.set(name, entry);
    }

    return {
      academicYear: ay
        ? {
            id: ay.id,
            name: ay.name,
            startDate: ay.startDate,
            endDate: ay.endDate,
            label: academicYearLabel(ay.startDate, ay.endDate),
          }
        : null,
      totalFeesExpected: roundMoney(totalExpected),
      totalCollected: roundMoney(totalCollected),
      totalPending,
      totalFinesCollected: roundMoney(totalFines),
      totalDiscounts: roundMoney(totalDiscounts),
      paidStudents: paidStatuses.size,
      pendingStudents: pendingStatuses.size,
      partialStudents: partialStatuses.size,
      todayCollected: roundMoney(todayCollection),
      currentMonthCollected: roundMoney(monthCollection),
      academicYearCollected: roundMoney(totalCollected),
      totalInvoices: invoices.length,
      collectionRate: totalExpected ? Math.round((totalCollected / totalExpected) * 100) : 0,
      monthlyCollection,
      classWise: Array.from(classMap.values()).map((c) => ({
        className: c.className,
        expected: roundMoney(c.expected),
        collected: roundMoney(c.collected),
        pending: roundMoney(c.pending),
      })),
    };
  },
};

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];