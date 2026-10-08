import { prisma } from "../config/database";
import { ConflictError, NotFoundError, TenantError } from "../utils/errors";

interface EmployeeData {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  joiningDate?: string | null;
  salary?: number | null;
  schoolId: string;
  branchId?: string | null;
}

interface DepartmentData {
  name?: string;
  code?: string;
  headId?: string | null;
  schoolId: string;
}

function requireSchool(schoolId: string | undefined, isSuperAdmin: boolean) {
  if (!schoolId && !isSuperAdmin) {
    throw new TenantError("School context required");
  }
}

const DEFAULT_SCOPE = (schoolId: string | undefined, isSuperAdmin: boolean) => {
  requireSchool(schoolId, isSuperAdmin);
  return schoolId ? { schoolId } : {};
};

const num = (d: unknown): number | null =>
  d == null ? null : Number(d);

const serializeEmployee = (e: any) => ({
  ...e,
  salary: num(e.salary),
});

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

export const hrService = {
  /* ---------------- Dashboard ---------------- */

  async getDashboardStats(schoolId: string | undefined, isSuperAdmin = false) {
    const scope = DEFAULT_SCOPE(schoolId, isSuperAdmin);
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const employeesInScope = await prisma.employee.findMany({
      where: scope,
      select: { id: true },
    });
    const employeeIds = employeesInScope.map((e) => e.id);

    const now = new Date();
    const [totalEmployees, departments, active, pendingLeaves, onLeaveToday] =
      await Promise.all([
        prisma.employee.count({ where: scope }),
        prisma.department.count({ where: scope }),
        prisma.employee.count({ where: { ...scope, status: "ACTIVE" } }),
        prisma.leave.count({
          where: {
            status: "PENDING",
            ...(employeeIds.length ? { employeeId: { in: employeeIds } } : {}),
          },
        }),
        prisma.leave.count({
          where: {
            status: "APPROVED",
            startDate: { lte: todayEnd },
            endDate: { gte: todayStart },
            ...(employeeIds.length ? { employeeId: { in: employeeIds } } : {}),
          },
        }),
      ]);

    const monthlyPayroll = await prisma.payroll.aggregate({
      where: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        ...(employeeIds.length ? { employeeId: { in: employeeIds } } : {}),
      },
      _sum: { netSalary: true },
      _count: true,
    });

    const recentLeaves = await prisma.leave.findMany({
      where: employeeIds.length
        ? { employeeId: { in: employeeIds } }
        : undefined,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return {
      totalEmployees,
      departments,
      active,
      onLeaveToday,
      pendingLeaves,
      monthlyPayroll: {
        count: monthlyPayroll._count,
        totalNet: num(monthlyPayroll._sum.netSalary),
      },
      recentLeaves,
    };
  },

  /* ---------------- Departments ---------------- */

  async listDepartments(schoolId: string | undefined, isSuperAdmin = false) {
    const scope = DEFAULT_SCOPE(schoolId, isSuperAdmin);
    const departments = await prisma.department.findMany({
      where: scope,
      orderBy: { name: "asc" },
    });
    const headIds = departments
      .map((d) => d.headId)
      .filter((id): id is string => !!id);
    const heads = headIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: headIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const headMap = new Map(heads.map((h) => [h.id, h]));
    return departments.map((d) => ({
      ...d,
      headName: d.headId ? headMap.get(d.headId) ? `${headMap.get(d.headId)!.firstName} ${headMap.get(d.headId)!.lastName}` : null : null,
    }));
  },

  async createDepartment(data: DepartmentData, isSuperAdmin = false) {
    requireSchool(data.schoolId, isSuperAdmin);
    const existing = await prisma.department.findUnique({
      where: { schoolId_code: { schoolId: data.schoolId, code: data.code! } },
    });
    if (existing) throw new ConflictError("A department with this code already exists");

    return prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: {
          name: data.name!,
          code: data.code!,
          headId: data.headId || null,
          schoolId: data.schoolId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "DEPARTMENT",
          entityId: department.id,
          schoolId: data.schoolId,
          newValue: { name: department.name, code: department.code },
        },
      });
      return department;
    });
  },

  async updateDepartment(
    id: string,
    schoolId: string | undefined,
    data: DepartmentData,
    isSuperAdmin = false
  ) {
    const department = await prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundError("Department");
    if (!isSuperAdmin && department.schoolId !== schoolId) throw new TenantError();

    if (data.code && data.code !== department.code) {
      const existing = await prisma.department.findFirst({
        where: {
          schoolId: department.schoolId,
          code: data.code,
          id: { not: id },
        },
      });
      if (existing) throw new ConflictError("A department with this code already exists");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          headId: data.headId === undefined ? undefined : data.headId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "DEPARTMENT",
          entityId: id,
          schoolId: department.schoolId,
          oldValue: { name: department.name },
          newValue: { name: updated.name, code: updated.code },
        },
      });
      return updated;
    });
  },

  async deleteDepartment(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const department = await prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundError("Department");
    if (!isSuperAdmin && department.schoolId !== schoolId) throw new TenantError();

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "DEPARTMENT",
          entityId: id,
          schoolId: department.schoolId,
          oldValue: { name: department.name, code: department.code },
        },
      });
      await tx.department.delete({ where: { id } });
    });
    return { success: true };
  },

  /* ---------------- Employees ---------------- */

  async listEmployees(schoolId: string | undefined, isSuperAdmin = false) {
    const scope = DEFAULT_SCOPE(schoolId, isSuperAdmin);
    const employees = await prisma.employee.findMany({
      where: scope,
      include: {
        _count: { select: { payroll: true, leaveRequests: true } },
        leaveRequests: {
          where: { status: "APPROVED", endDate: { gte: endOfToday() } },
          orderBy: { endDate: "asc" },
          take: 1,
          select: {
            id: true,
            type: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { joiningDate: "desc" },
    });
    return employees.map(serializeEmployee);
  },

  async getEmployeeById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        leaveRequests: { orderBy: { createdAt: "desc" } },
        payroll: { orderBy: [{ year: "desc" }, { month: "desc" }] },
      },
    });
    if (!employee) throw new NotFoundError("Employee");
    if (!isSuperAdmin && employee.schoolId !== schoolId) throw new TenantError();
    return {
      ...serializeEmployee(employee),
      leaveRequests: employee.leaveRequests.map((l) => ({
        ...l,
        startDate: l.startDate,
        endDate: l.endDate,
      })),
      payroll: employee.payroll.map((p) => ({
        ...p,
        basicSalary: num(p.basicSalary),
        deductions: num(p.deductions),
        bonuses: num(p.bonuses),
        netSalary: num(p.netSalary),
      })),
    };
  },

  async createEmployee(data: EmployeeData, isSuperAdmin = false) {
    requireSchool(data.schoolId, isSuperAdmin);

    let employeeId = data.employeeId?.trim().toUpperCase();
    if (!employeeId) {
      const count = await prisma.employee.count({
        where: { schoolId: data.schoolId },
      });
      const base = String(count + 1).padStart(3, "0");
      const candidate = `EMP${base}`;
      const existing = await prisma.employee.findUnique({
        where: {
          schoolId_employeeId: { schoolId: data.schoolId, employeeId: candidate },
        },
      });
      employeeId = existing ? `EMP${Date.now()}` : candidate;
    }

    const duplicate = await prisma.employee.findUnique({
      where: {
        schoolId_employeeId: { schoolId: data.schoolId, employeeId },
      },
    });
    if (duplicate) throw new ConflictError("An employee with this ID already exists");

    if (data.email) {
      const emailDup = await prisma.employee.findFirst({
        where: { schoolId: data.schoolId, email: data.email },
      });
      if (emailDup) throw new ConflictError("An employee with this email already exists");
    }

    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeId,
          firstName: data.firstName!,
          lastName: data.lastName!,
          phone: data.phone || null,
          email: data.email || null,
          department: data.department || null,
          designation: data.designation || null,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
          salary: data.salary ?? null,
          schoolId: data.schoolId,
          branchId: data.branchId || null,
          status: "ACTIVE",
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "EMPLOYEE",
          entityId: employee.id,
          schoolId: data.schoolId,
          newValue: { employeeId, name: `${employee.firstName} ${employee.lastName}` },
        },
      });
      return serializeEmployee(employee);
    });
  },

  async updateEmployee(
    id: string,
    schoolId: string | undefined,
    data: EmployeeData,
    isSuperAdmin = false
  ) {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundError("Employee");
    if (!isSuperAdmin && employee.schoolId !== schoolId) throw new TenantError();

    if (data.employeeId) {
      const dup = await prisma.employee.findFirst({
        where: {
          schoolId: employee.schoolId,
          employeeId: data.employeeId.trim().toUpperCase(),
          id: { not: id },
        },
      });
      if (dup) throw new ConflictError("An employee with this ID already exists");
    }

    if (data.email !== undefined && data.email !== null && data.email !== "") {
      const emailDup = await prisma.employee.findFirst({
        where: {
          schoolId: employee.schoolId,
          email: data.email,
          id: { not: id },
        },
      });
      if (emailDup) throw new ConflictError("An employee with this email already exists");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id },
        data: {
          employeeId: data.employeeId
            ? data.employeeId.trim().toUpperCase()
            : undefined,
          firstName: data.firstName ?? undefined,
          lastName: data.lastName ?? undefined,
          phone: data.phone === undefined ? undefined : data.phone,
          email: data.email === undefined ? undefined : data.email || null,
          department: data.department === undefined ? undefined : data.department || null,
          designation: data.designation === undefined ? undefined : data.designation || null,
          joiningDate:
            data.joiningDate === undefined
              ? undefined
              : data.joiningDate
              ? new Date(data.joiningDate)
              : null,
          salary: data.salary === undefined ? undefined : data.salary ?? null,
          status: (data as any).status ?? undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "EMPLOYEE",
          entityId: id,
          schoolId: employee.schoolId,
          oldValue: { employeeId: employee.employeeId },
          newValue: { employeeId: updated.employeeId },
        },
      });
      return serializeEmployee(updated);
    });
  },

  async deleteEmployee(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundError("Employee");
    if (!isSuperAdmin && employee.schoolId !== schoolId) throw new TenantError();

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "EMPLOYEE",
          entityId: id,
          schoolId: employee.schoolId,
          oldValue: {
            employeeId: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
          },
        },
      });
      await tx.payroll.deleteMany({ where: { employeeId: id } });
      await tx.employee.delete({ where: { id } });
    });
    return { success: true };
  },

  /* ---------------- Leave ---------------- */

  async listLeaves(params: {
    schoolId?: string;
    isSuperAdmin?: boolean;
    status?: string;
  }) {
    const scope = DEFAULT_SCOPE(params.schoolId || undefined, !!params.isSuperAdmin);
    const where: any = {
      ...(params.status ? { status: params.status } : {}),
    };
    if (scope.schoolId) where.employee = { schoolId: scope.schoolId };

    const leaves = await prisma.leave.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });
    return leaves;
  },

  async createLeave(
    data: {
      employeeId: string;
      type: string;
      startDate: string;
      endDate: string;
      reason?: string | null;
      schoolId?: string;
    },
    isSuperAdmin = false
  ) {
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });
    if (!employee) throw new NotFoundError("Employee");

    const schoolId = data.schoolId ?? employee.schoolId;
    if (!isSuperAdmin && employee.schoolId !== schoolId) throw new TenantError();

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end < start) throw new ConflictError("End date cannot be before start date");
    if (end < startOfToday()) throw new ConflictError("Leave dates are in the past");

    return prisma.$transaction(async (tx) => {
      const leave = await tx.leave.create({
        data: {
          employeeId: employee.id,
          type: data.type,
          startDate: start,
          endDate: end,
          reason: data.reason || null,
          status: "PENDING",
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "LEAVE",
          entityId: leave.id,
          schoolId: employee.schoolId,
          newValue: {
            employeeId: employee.employeeId,
            type: data.type,
            startDate: data.startDate,
            endDate: data.endDate,
          },
        },
      });
      return leave;
    });
  },

  async updateLeaveStatus(
    id: string,
    status: "APPROVED" | "REJECTED" | "CANCELLED",
    schoolId: string | undefined,
    approvedBy: string | undefined,
    isSuperAdmin = false
  ) {
    const leave = await prisma.leave.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!leave) throw new NotFoundError("Leave request");
    if (!isSuperAdmin && leave.employee.schoolId !== schoolId) throw new TenantError();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.leave.update({
        where: { id },
        data: {
          status,
          approvedBy: status === "APPROVED" || status === "REJECTED" ? approvedBy : undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "LEAVE",
          entityId: id,
          schoolId: leave.employee.schoolId,
          oldValue: { status: leave.status },
          newValue: { status },
        },
      });
      return updated;
    });
  },

  /* ---------------- Payroll ---------------- */

  async listPayroll(params: {
    schoolId?: string;
    isSuperAdmin?: boolean;
    month?: number;
    year?: number;
  }) {
    const scope = DEFAULT_SCOPE(params.schoolId || undefined, !!params.isSuperAdmin);
    const where: any = {
      ...(params.month ? { month: params.month } : {}),
      ...(params.year ? { year: params.year } : {}),
    };
    where.employee = scope.schoolId ? { schoolId: scope.schoolId } : {};

    const rows = await prisma.payroll.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((p) => ({
      ...p,
      basicSalary: num(p.basicSalary),
      deductions: num(p.deductions),
      bonuses: num(p.bonuses),
      netSalary: num(p.netSalary),
    }));
  },

  async generatePayroll(
    data: { month: number; year: number; schoolId?: string },
    isSuperAdmin = false,
    currentSchoolId?: string
  ) {
    const schoolId = data.schoolId || currentSchoolId;
    requireSchool(schoolId, isSuperAdmin);
    if (!schoolId) throw new TenantError("School context required");

    const employees = await prisma.employee.findMany({
      where: {
        schoolId,
        status: "ACTIVE",
        salary: { gt: 0 },
      },
    });

    let created = 0;
    for (const emp of employees) {
      const existing = await prisma.payroll.findUnique({
        where: {
          employeeId_month_year: {
            employeeId: emp.id,
            month: data.month,
            year: data.year,
          },
        },
      });
      if (existing) continue;
      const salary = num(emp.salary) ?? 0;
      await prisma.payroll.create({
        data: {
          employeeId: emp.id,
          month: data.month,
          year: data.year,
          basicSalary: salary,
          deductions: 0,
          bonuses: 0,
          netSalary: salary,
          status: "PENDING",
        },
      });
      created += 1;
    }

    return { success: true, created };
  },

  async markPayrollPaid(
    id: string,
    schoolId: string | undefined,
    paidBy: string | undefined,
    isSuperAdmin = false
  ) {
    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!payroll) throw new NotFoundError("Payroll record");
    if (!isSuperAdmin && payroll.employee.schoolId !== schoolId) throw new TenantError();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payroll.update({
        where: { id },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "PAYROLL",
          entityId: id,
          schoolId: payroll.employee.schoolId,
          oldValue: { status: "PENDING" },
          newValue: {
            status: "PAID",
            month: payroll.month,
            year: payroll.year,
            paidBy,
          },
        },
      });
      return { ...updated, netSalary: num(updated.netSalary) };
    });
  },

  async payAllPending(
    data: { month: number; year: number; schoolId?: string },
    isSuperAdmin = false,
    currentSchoolId?: string,
    paidBy?: string
  ) {
    const schoolId = data.schoolId || currentSchoolId;
    requireSchool(schoolId, isSuperAdmin);
    if (!schoolId) throw new TenantError("School context required");

    const records = await prisma.payroll.findMany({
      where: {
        status: "PENDING",
        month: data.month,
        year: data.year,
        employee: { schoolId },
      },
      include: { employee: { select: { schoolId: true } } },
    });
    if (records.length === 0) return { success: true, paid: 0 };

    await prisma.payroll.updateMany({
      where: { id: { in: records.map((r) => r.id) }, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "PAYROLL",
        entityId: records[0].id,
        schoolId: records[0].employee.schoolId,
        oldValue: { status: "PENDING" },
        newValue: {
          status: "PAID",
          month: data.month,
          year: data.year,
          count: records.length,
          paidBy,
        },
      },
    });

    return { success: true, paid: records.length };
  },
};