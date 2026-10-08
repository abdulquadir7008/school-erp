import { prisma } from "../config/database";
import { TenantError } from "../utils/errors";

function requireSchool(schoolId: string | undefined, isSuperAdmin: boolean) {
  if (!schoolId && !isSuperAdmin) {
    throw new TenantError("School context required");
  }
}

const num0 = (d: unknown): number => (d == null ? 0 : Number(d));

const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;

const monthStart = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1));

const daysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const PRESENT_STATES = new Set(["PRESENT", "LATE", "HALF_DAY"]);
const ABSENT_STATES = new Set(["ABSENT", "LEAVE"]);

interface MonthPoint {
  month: number;
  year: number;
  label: string;
  count: number;
}

const monthLabel = (y: number, m: number) =>
  new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

function last12Months(fromYear: number, fromMonth: number): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(fromYear, fromMonth - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    points.push({ month: m, year: y, label: `${monthLabel(y, m)} ${String(y).slice(2)}`, count: 0 });
  }
  return points;
}

function bucketByMonth(points: MonthPoint[], rows: { admissionDate?: Date | null }[]) {
  const map = new Map(points.map((p) => [`${p.year}-${p.month}`, p]));
  for (const r of rows) {
    if (!r.admissionDate) continue;
    const key = `${r.admissionDate.getUTCFullYear()}-${r.admissionDate.getUTCMonth() + 1}`;
    const p = map.get(key);
    if (p) p.count += 1;
  }
  return points;
}

export const reportService = {
  /* ---------------- Overview ---------------- */

  async overview(schoolId: string | undefined, isSuperAdmin: boolean, month = MONTH, year = YEAR) {
    requireSchool(schoolId, isSuperAdmin);
    const scope = schoolId ? { schoolId } : {};

    const start = monthStart(year, month);
    const end = monthStart(year, month + 1);

    const [studentTotal, studentActive, genderGroup, byClassGroup, classes, attendanceRecords, payments, invoices, bookCount, availAgg, bookIssues, employeeCount, employeeActive, employeeGroup, vehicles, routes, transportAssignments] =
      await Promise.all([
        prisma.student.count({ where: scope }),
        prisma.student.count({ where: { ...scope, status: "ACTIVE" } }),
        prisma.student.groupBy({ by: ["gender"], _count: { _all: true }, where: scope }),
        prisma.student.groupBy({ by: ["classId"], _count: { _all: true }, where: scope }),
        prisma.schoolClass.findMany({ where: scope, select: { id: true, name: true } }),
        prisma.attendance.findMany({ where: { ...scope, date: { gte: start, lt: end } }, select: { status: true } }),
        prisma.payment.findMany({ where: { ...scope, status: "COMPLETED", paidAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, select: { amount: true } }),
        prisma.invoice.findMany({ where: { ...scope, status: { notIn: ["CANCELLED", "REFUNDED"] } }, select: { totalAmount: true, discount: true, paidAmount: true, status: true } }),
        prisma.book.count({ where: scope }),
        prisma.book.aggregate({ where: scope, _sum: { available: true } }),
        prisma.libraryIssue.count({ where: { ...scope, status: { not: "RETURNED" } } }),
        prisma.employee.count({ where: scope }),
        prisma.employee.count({ where: { ...scope, status: "ACTIVE" } }),
        prisma.employee.groupBy({ by: ["department"], _count: { _all: true }, where: scope }),
        prisma.vehicle.count({ where: scope }),
        prisma.route.count({ where: scope }),
        prisma.studentTransport.count({ where: scope }),
      ]);

    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    const byClass = byClassGroup.map((g) => ({ className: classMap.get(g.classId) || "Unassigned", count: g._count._all }));

    const attendanceTotal = attendanceRecords.length;
    const attendancePresent = attendanceRecords.filter((r) => PRESENT_STATES.has(r.status)).length;
    const attendanceAbsent = attendanceRecords.filter((r) => ABSENT_STATES.has(r.status)).length;

    const financeCollected = payments.reduce((s, p) => s + num0(p.amount), 0);
    const outstanding = invoices.reduce((s, i) => s + Math.max(0, num0(i.totalAmount) - num0(i.discount) - num0(i.paidAmount)), 0);
    const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

return {
      students: { total: studentTotal, active: studentActive, attendanceRate: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : null },
      attendanceMonth: { month, year, total: attendanceTotal, present: attendancePresent, absent: attendanceAbsent },
      finance: { collected: financeCollected, outstanding, overdue: overdueCount, invoiceCount: invoices.length },
      library: { books: bookCount, availableCopies: num0(availAgg._sum.available), issued: bookIssues },
      hr: { total: employeeCount, active: employeeActive },
      transport: { vehicles, routes, assigned: transportAssignments },
      gender: genderGroup.map((g) => ({ gender: g.gender, count: g._count._all })),
      byClass,
      byDepartment: employeeGroup
        .filter((g) => g.department)
        .map((g) => ({ department: g.department!, count: g._count._all })),
    };
  },

  /* ---------------- Students ---------------- */

  async students(schoolId: string | undefined, isSuperAdmin: boolean) {
    requireSchool(schoolId, isSuperAdmin);
    const scope = schoolId ? { schoolId } : {};

    const [classes, students] = await Promise.all([
      prisma.schoolClass.findMany({ where: scope, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.student.findMany({ where: scope, select: { gender: true, status: true, admissionDate: true, classId: true } }),
    ]);

    const byClass = classes.map((c) => ({
      className: c.name,
      total: students.filter((s) => s.classId === c.id).length,
      active: students.filter((s) => s.classId === c.id && s.status === "ACTIVE").length,
    }));

    const gender = (["MALE", "FEMALE", "OTHER"] as const).map((g) => ({
      gender: g,
      count: students.filter((s) => s.gender === g).length,
    }));

    const status = (["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED", "EXPELLED"] as const).map((st) => ({
      status: st,
      count: students.filter((s) => s.status === st).length,
    }));

    const admissions = bucketByMonth(last12Months(MONTH, YEAR), students.filter((s) => s.admissionDate));

    return { total: students.length, byClass, gender, status, admissions };
  },

  /* ---------------- Attendance ---------------- */

  async attendance(schoolId: string | undefined, isSuperAdmin: boolean, month = MONTH, year = YEAR) {
    requireSchool(schoolId, isSuperAdmin);
    const scope = schoolId ? { schoolId } : {};

    const start = monthStart(year, month);
    const end = monthStart(year, month + 1);

    const [records, classes] = await Promise.all([
      prisma.attendance.findMany({
        where: { ...scope, date: { gte: start, lt: end } },
        select: { status: true, date: true, studentId: true, student: { select: { classId: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.schoolClass.findMany({ where: scope, select: { id: true, name: true } }),
    ]);

    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    const days = daysInMonth(year, month);

    const daily = Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const dayRecords = records.filter((r) => r.date.getUTCDate() === day);
      const present = dayRecords.filter((r) => PRESENT_STATES.has(r.status)).length;
      return {
        day,
        label: `${monthLabel(year, month)} ${day}`,
        total: dayRecords.length,
        present,
        rate: dayRecords.length ? Math.round((present / dayRecords.length) * 100) : null,
      };
    });

    const classMapAgg = new Map<string, { className: string; total: number; present: number }>();
    for (const r of records) {
      const name = classMap.get(r.student.classId) || "Unassigned";
      const agg = classMapAgg.get(name) || { className: name, total: 0, present: 0 };
      agg.total += 1;
      if (PRESENT_STATES.has(r.status)) agg.present += 1;
      classMapAgg.set(name, agg);
    }
    const byClass = Array.from(classMapAgg.values()).map((c) => ({
      className: c.className,
      total: c.total,
      present: c.present,
      rate: c.total ? Math.round((c.present / c.total) * 100) : null,
    }));

    const status = (["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE"] as const).map((s) => ({
      status: s,
      count: records.filter((r) => r.status === s).length,
    }));

    const total = records.length;
    const present = records.filter((r) => PRESENT_STATES.has(r.status)).length;

    return {
      month,
      year,
      overall: { total, present, absent: total - present, rate: total ? Math.round((present / total) * 100) : null },
      daily,
      byClass,
      status,
    };
  },

  /* ---------------- Finance ---------------- */

  async finance(schoolId: string | undefined, isSuperAdmin: boolean, year = YEAR) {
    requireSchool(schoolId, isSuperAdmin);
    const scope = schoolId ? { schoolId } : {};

    const [payments, invoices] = await Promise.all([
      prisma.payment.findMany({
        where: { ...scope, status: "COMPLETED", paidAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
        select: { amount: true, paidAt: true },
      }),
      prisma.invoice.findMany({
        where: { ...scope, status: { notIn: ["CANCELLED", "REFUNDED"] } },
        select: { totalAmount: true, discount: true, paidAmount: true, status: true, student: { select: { class: { select: { name: true } } } } },
      }),
    ]);

    const monthly = last12Months(YEAR, YEAR === year ? MONTH : 12).map((p) => ({
      ...p,
      count: 0,
      collected: 0,
    }));
    const monthlyMap = new Map(monthly.map((m) => [`${m.year}-${m.month}`, m]));
    for (const p of payments) {
      const key = `${p.paidAt.getUTCFullYear()}-${p.paidAt.getUTCMonth() + 1}`;
      const m = monthlyMap.get(key);
      if (m) {
        m.count += 1;
        m.collected += num0(p.amount);
      }
    }

    const collected = payments.reduce((s, p) => s + num0(p.amount), 0);

    const outstandingMap = new Map<string, { className: string; billed: number; collected: number; outstanding: number }>();
    for (const inv of invoices) {
      const name = inv.student?.class?.name || "Unassigned";
      const agg = outstandingMap.get(name) || { className: name, billed: 0, collected: 0, outstanding: 0 };
      const billedAmount = num0(inv.totalAmount) - num0(inv.discount);
      agg.billed += billedAmount;
      agg.collected += Math.min(num0(inv.paidAmount), billedAmount);
      agg.outstanding += Math.max(0, billedAmount - num0(inv.paidAmount));
      outstandingMap.set(name, agg);
    }
    const outstandingByClass = Array.from(outstandingMap.values()).sort((a, b) => b.outstanding - a.outstanding);

    const status = (["PAID", "PARTIAL", "PENDING", "OVERDUE"] as const).map((s) => ({
      status: s,
      count: invoices.filter((i) => i.status === s).length,
      amount: invoices.filter((i) => i.status === s).reduce((sum, i) => sum + Math.max(0, num0(i.totalAmount) - num0(i.discount) - num0(i.paidAmount)), 0),
    }));

    const outstanding = invoices.reduce((s, i) => s + Math.max(0, num0(i.totalAmount) - num0(i.discount) - num0(i.paidAmount)), 0);

    return {
      year,
      collected,
      outstanding,
      overdue: invoices.filter((i) => i.status === "OVERDUE").length,
      invoiceCount: invoices.length,
      monthly,
      outstandingByClass,
      status,
    };
  },

  /* ---------------- HR ---------------- */

  async hr(schoolId: string | undefined, isSuperAdmin: boolean, month = MONTH, year = YEAR) {
    requireSchool(schoolId, isSuperAdmin);
    const scope = schoolId ? { schoolId } : {};

    const [employees, deptGroup, payroll] = await Promise.all([
      prisma.employee.findMany({ where: scope, select: { status: true, department: true, salary: true } }),
      prisma.employee.groupBy({ by: ["department"], _count: { _all: true }, where: scope }),
      prisma.payroll.findMany({ where: { month, year, employee: schoolId ? { schoolId } : {} }, select: { netSalary: true, status: true } }),
    ]);

    const total = employees.length;
    const active = employees.filter((e) => e.status === "ACTIVE").length;
    const avgSalary = total ? Math.round(employees.reduce((s, e) => s + num0(e.salary), 0) / total) : 0;

    const byDepartment = deptGroup.filter((g) => g.department).map((g) => ({ department: g.department!, count: g._count._all }));

    const payrollTotal = payroll.reduce((s, p) => s + num0(p.netSalary), 0);
    const payrollPending = payroll.filter((p) => p.status !== "PAID").length;

    return {
      total,
      active,
      avgSalary,
      byDepartment,
      payroll: {
        month,
        year,
        count: payroll.length,
        totalNet: payrollTotal,
        pending: payrollPending,
        paid: payroll.length - payrollPending,
      },
    };
  },

  /* ---------------- Library ---------------- */

  async library(schoolId: string | undefined, isSuperAdmin: boolean) {
    requireSchool(schoolId, isSuperAdmin);
    const scope = schoolId ? { schoolId } : {};

    const [books, avail, issues, recent] = await Promise.all([
      prisma.book.count({ where: scope }),
      prisma.book.aggregate({ where: scope, _sum: { available: true, totalCopies: true } }),
      prisma.libraryIssue.findMany({ where: { ...scope, status: { not: "RETURNED" } }, select: { status: true, book: { select: { category: true } } } }),
      prisma.libraryIssue.findMany({
        where: { ...scope },
        include: { book: { select: { title: true, category: true } }, student: { select: { firstName: true, lastName: true } } },
        orderBy: { issueDate: "desc" },
        take: 8,
      }),
    ]);

    const byCategory = new Map<string, { category: string; issued: number }>();
    for (const i of issues) {
      const cat = i.book.category || "Uncategorised";
      const agg = byCategory.get(cat) || { category: cat, issued: 0 };
      agg.issued += 1;
      byCategory.set(cat, agg);
    }

    return {
      books,
      totalCopies: num0(avail._sum.totalCopies),
      availableCopies: num0(avail._sum.available),
      issued: issues.length,
      overdue: issues.filter((i) => i.status === "OVERDUE").length,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.issued - a.issued),
      recent: recent.map((r) => ({
        id: r.id,
        book: r.book.title,
        category: r.book.category || "—",
        student: `${r.student.firstName} ${r.student.lastName}`,
        issueDate: r.issueDate,
        dueDate: r.dueDate,
        status: r.status,
      })),
    };
  },

  /* ---------------- Transport ---------------- */

  async transport(schoolId: string | undefined, isSuperAdmin: boolean) {
    requireSchool(schoolId, isSuperAdmin);
    const scope = schoolId ? { schoolId } : {};

    const [vehicles, routes, assignments, routeGroup] = await Promise.all([
      prisma.vehicle.count({ where: scope }),
      prisma.route.findMany({ where: scope, select: { id: true, name: true, vehicle: { select: { registrationNo: true } }, _count: { select: { stops: true } } }, orderBy: { name: "asc" } }),
      prisma.studentTransport.count({ where: scope }),
      prisma.studentTransport.groupBy({ by: ["routeId"], _count: { _all: true }, where: scope }),
    ]);

    const routeMap = new Map(routes.map((r) => [r.id, r]));
    const byRoute = routeGroup.map((g) => {
      const route = routeMap.get(g.routeId);
      return {
        routeName: route?.name || "Unknown",
        vehicle: route?.vehicle.registrationNo || "—",
        stops: route?._count.stops ?? 0,
        students: g._count._all,
      };
    });

    return { vehicles, routes: routes.length, assigned: assignments, byRoute };
  },
};