"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  Users,
  GraduationCap,
  CalendarCheck,
  Wallet,
  Briefcase,
  Library,
  Bus,
  Download,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";

/* ================= Types ================= */

interface OverviewReport {
  students: { total: number; active: number; attendanceRate: number | null };
  attendanceMonth: { month: number; year: number; total: number; present: number; absent: number };
  finance: { collected: number; outstanding: number; overdue: number; invoiceCount: number };
  library: { books: number; availableCopies: number; issued: number };
  hr: { total: number; active: number };
  transport: { vehicles: number; routes: number; assigned: number };
  gender: { gender: string; count: number }[];
  byClass: { className: string; count: number }[];
  byDepartment: { department: string; count: number }[];
}

interface StudentReport {
  total: number;
  byClass: { className: string; total: number; active: number }[];
  gender: { gender: string; count: number }[];
  status: { status: string; count: number }[];
  admissions: { month: number; year: number; label: string; count: number }[];
}

interface AttendanceReport {
  month: number;
  year: number;
  overall: { total: number; present: number; absent: number; rate: number | null };
  daily: { day: number; label: string; total: number; present: number; rate: number | null }[];
  byClass: { className: string; total: number; present: number; rate: number | null }[];
  status: { status: string; count: number }[];
}

interface FinanceReport {
  year: number;
  collected: number;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
  monthly: { month: number; year: number; label: string; count: number; collected: number }[];
  outstandingByClass: { className: string; billed: number; collected: number; outstanding: number }[];
  status: { status: string; count: number; amount: number }[];
}

interface HRReport {
  total: number;
  active: number;
  avgSalary: number;
  byDepartment: { department: string; count: number }[];
  payroll: { month: number; year: number; count: number; totalNet: number; pending: number; paid: number };
}

interface LibraryReport {
  books: number;
  totalCopies: number;
  availableCopies: number;
  issued: number;
  overdue: number;
  byCategory: { category: string; issued: number }[];
  recent: { id: string; book: string; category: string; student: string; issueDate: string; dueDate: string; status: string }[];
}

interface TransportReport {
  vehicles: number;
  routes: number;
  assigned: number;
  byRoute: { routeName: string; vehicle: string; stops: number; students: number }[];
}

interface SchoolOption {
  id: string;
  name: string;
  schoolCode: string;
}

/* ================= Formatters & helpers ================= */

type T = (key: string, params?: Record<string, string | number>) => string;

const MONTH_KEYS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const cur = (v?: number | null) =>
  v == null || Number.isNaN(v)
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const fmtPct = (v?: number | null) => (v == null ? "—" : `${v}%`);

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const rateColor = (rate?: number | null) => {
  if (rate == null) return "text-slate-400";
  if (rate < 75) return "text-red-600";
  if (rate < 90) return "text-amber-600";
  return "text-green-600";
};

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][], t: T) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(t("reports.exportedToast", { filename }));
}

function BarRow({ label, value, max, suffix, color }: { label: string; value: number; max: number; suffix?: string; color?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-400">{value}{suffix ? ` ${suffix}` : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${color || "bg-primary-500"}`}
          style={{ width: `${Math.round((value / Math.max(1, max)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function MiniBars({ data, valueKey, max, suffix }: { data: { label: string }[]; valueKey: string; max: number; suffix?: string }) {
  return (
    <div className="flex h-28 items-end gap-1.5">
      {data.map((d, i) => {
        const v = Number((d as Record<string, unknown>)[valueKey]) || 0;
        const h = Math.round((v / Math.max(1, max)) * 100);
        return (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
              {d.label}: {v}{suffix ? ` ${suffix}` : ""}
            </div>
            <div
              className="w-full rounded-t bg-primary-500"
              style={{ height: `${Math.max(3, h)}%`, minHeight: h > 0 ? 4 : 2 }}
            />
            <span className="mt-1 hidden truncate text-center text-[9px] text-slate-400 sm:block">
              {d.label.slice(0, 6)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ================= Main page ================= */

type ReportTab = "overview" | "students" | "attendance" | "finance" | "hr" | "library" | "transport";

function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";

  const has = (p: string) =>
    !!user &&
    (user.isSuperAdmin ||
      user.roleName === "SUPER_ADMIN" ||
      user.roleName === "SCHOOL_ADMIN" ||
      user.permissions?.includes(p) ||
      false);

  const canView = has("report.view");
  const canExport = has("report.export");

  const monthLabels = useMemo(
    () => MONTH_KEYS.map((m) => t(`reports.month${m}`)),
    [t]
  );

  const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: t("reports.tabOverview"), icon: <BarChart3 className="h-4 w-4" /> },
    { id: "students", label: t("reports.tabStudents"), icon: <Users className="h-4 w-4" /> },
    { id: "attendance", label: t("reports.tabAttendance"), icon: <CalendarCheck className="h-4 w-4" /> },
    { id: "finance", label: t("reports.tabFinance"), icon: <Wallet className="h-4 w-4" /> },
    { id: "hr", label: t("reports.tabHr"), icon: <Briefcase className="h-4 w-4" /> },
    { id: "library", label: t("reports.tabLibrary"), icon: <Library className="h-4 w-4" /> },
    { id: "transport", label: t("reports.tabTransport"), icon: <Bus className="h-4 w-4" /> },
  ];

  const now = new Date();
  const [tab, setTab] = useState<ReportTab>("overview");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const schoolId = isSuperAdmin ? selectedSchoolId : user?.schoolId || "";

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const schoolsQuery = useQuery({
    queryKey: ["report-schools"],
    queryFn: async () => {
      const res = await api.get("/schools", { params: { limit: 100 } });
      return res.data.data as SchoolOption[];
    },
    enabled: isSuperAdmin,
  });

  const params = {
    ...(schoolId ? { schoolId } : {}),
    month,
    year,
  };

  const overviewQuery = useQuery({
    queryKey: ["report-overview", schoolId, month, year],
    queryFn: async () => {
      const res = await api.get("/reports/overview", { params });
      return res.data.data as OverviewReport;
    },
    enabled: canView,
  });

  const studentsQuery = useQuery({
    queryKey: ["report-students", schoolId],
    queryFn: async () => {
      const res = await api.get("/reports/students", { params: schoolId ? { schoolId } : {} });
      return res.data.data as StudentReport;
    },
    enabled: canView,
  });

  const attendanceQuery = useQuery({
    queryKey: ["report-attendance", schoolId, month, year],
    queryFn: async () => {
      const res = await api.get("/reports/attendance", { params });
      return res.data.data as AttendanceReport;
    },
    enabled: canView,
  });

  const financeQuery = useQuery({
    queryKey: ["report-finance", schoolId, year],
    queryFn: async () => {
      const res = await api.get("/reports/finance", { params: { ...(schoolId ? { schoolId } : {}), year } });
      return res.data.data as FinanceReport;
    },
    enabled: canView,
  });

  const hrQuery = useQuery({
    queryKey: ["report-hr", schoolId, month, year],
    queryFn: async () => {
      const res = await api.get("/reports/hr", { params });
      return res.data.data as HRReport;
    },
    enabled: canView,
  });

  const libraryQuery = useQuery({
    queryKey: ["report-library", schoolId],
    queryFn: async () => {
      const res = await api.get("/reports/library", { params: schoolId ? { schoolId } : {} });
      return res.data.data as LibraryReport;
    },
    enabled: canView,
  });

  const transportQuery = useQuery({
    queryKey: ["report-transport", schoolId],
    queryFn: async () => {
      const res = await api.get("/reports/transport", { params: schoolId ? { schoolId } : {} });
      return res.data.data as TransportReport;
    },
    enabled: canView,
  });

  const overview = overviewQuery.data;
  const studentReport = studentsQuery.data;
  const attReport = attendanceQuery.data;
  const finReport = financeQuery.data;
  const hrReport = hrQuery.data;
  const libReport = libraryQuery.data;
  const transpReport = transportQuery.data;

  const maxClassStudents = useMemo(() => Math.max(1, ...(studentReport?.byClass || []).map((c) => c.total)), [studentReport]);
  const maxAttendance = useMemo(() => Math.max(1, ...(attReport?.daily || []).map((d) => d.total)), [attReport]);
  const maxFinance = useMemo(() => Math.max(1, ...(finReport?.monthly || []).map((m) => m.collected)), [finReport]);
  const maxDept = useMemo(() => Math.max(1, ...(hrReport?.byDepartment || []).map((d) => d.count)), [hrReport]);
  const maxLibCat = useMemo(() => Math.max(1, ...(libReport?.byCategory || []).map((c) => c.issued)), [libReport]);

  const ExportButton = ({ label, onClick }: { label: string; onClick: () => void }) =>
    canExport ? (
      <Button size="sm" variant="outline" onClick={onClick} disabled={isSuperAdmin && !schoolId}>
        <Download className="me-1.5 h-3.5 w-3.5" />{label}
      </Button>
    ) : null;

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">{t("reports.noAccess")}</p>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <BarChart3 className="h-6 w-6 text-primary-600" />
            {t("nav.reports")}
          </h1>
          <p className="text-sm text-slate-500">{t("reports.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <Select value={selectedSchoolId} onChange={(e) => setSelectedSchoolId(e.target.value)} className="w-56">
              <option value="">{t("reports.allSchools")}</option>
              {(schoolsQuery.data || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          )}
          {tab !== "students" && tab !== "library" && tab !== "transport" && (
            <>
              <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
                {monthLabels.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24"
              />
            </>
          )}
          {tab === "finance" && (
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ OVERVIEW ============ */}
      {tab === "overview" && (
        <>
          {overviewQuery.isLoading ? (
            <Card><CardContent><LoadingState label={t("reports.loadingOverview")} /></CardContent></Card>
          ) : overviewQuery.isError || !overview ? (
            <Card><CardContent><ErrorState message={t("reports.loadErrorOverview")} onRetry={() => overviewQuery.refetch()} /></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title={t("reports.totalStudents")} value={String(overview.students.total)} change={t("reports.activeCount", { n: overview.students.active })} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
                <StatCard title={t("reports.attendanceStatTitle", { month: monthLabels[overview.attendanceMonth.month - 1], year: overview.attendanceMonth.year })} value={fmtPct(overview.students.attendanceRate)} change={t("reports.recordsCount", { n: overview.attendanceMonth.total })} icon={<CalendarCheck className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
                <StatCard title={t("reports.collectedIn", { year: overview.finance ? String(year) : "" })} value={cur(overview.finance.collected)} change={t("reports.invoicesCount", { n: overview.finance.invoiceCount })} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-50 text-emerald-600" />
                <StatCard title={t("reports.outstandingFees")} value={cur(overview.finance.outstanding)} change={overview.finance.overdue ? t("reports.overdueCount", { n: overview.finance.overdue }) : undefined} icon={<TrendingDown className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("reports.byClassTitle")}</CardTitle>
                    <CardDescription>{t("reports.byClassDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {overview.byClass.length === 0 ? (
                      <EmptyState title={t("reports.noStudents")} description={t("reports.byClassEmptyDesc")} />
                    ) : (
                      <div className="space-y-3">
                        {overview.byClass.slice(0, 8).map((c) => (
                          <BarRow key={c.className} label={c.className} value={c.count} max={Math.max(1, ...overview.byClass.map((x) => x.count))} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("reports.attendanceStatTitle", { month: monthLabels[overview.attendanceMonth.month - 1], year: overview.attendanceMonth.year })}</CardTitle>
                    <CardDescription>{t("reports.attendanceCardDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg bg-slate-50 p-4 text-center">
                      <p className="text-xs text-slate-500">{t("reports.attendanceRate")}</p>
                      <p className={`mt-1 text-3xl font-semibold ${rateColor(overview.students.attendanceRate)}`}>{fmtPct(overview.students.attendanceRate)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-slate-100 p-3">
                        <p className="text-lg font-semibold text-green-600">{overview.attendanceMonth.present}</p>
                        <p className="text-xs text-slate-500">{t("reports.present")}</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 p-3">
                        <p className="text-lg font-semibold text-red-600">{overview.attendanceMonth.absent}</p>
                        <p className="text-xs text-slate-500">{t("reports.absent")}</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 p-3">
                        <p className="text-lg font-semibold text-slate-700">{overview.attendanceMonth.total}</p>
                        <p className="text-xs text-slate-500">{t("reports.records")}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {overview.gender.map((g) => (
                        <Badge key={g.gender} variant="outline">{g.gender} · {g.count}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("reports.operationsTitle")}</CardTitle>
                    <CardDescription>{t("reports.operationsDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: t("reports.paidStaff"), value: t("reports.xOfY", { a: overview.hr.active, b: overview.hr.total }) },
                      { label: t("reports.libraryBooks"), value: String(overview.library.books) },
                      { label: t("reports.copiesAvailable"), value: String(overview.library.availableCopies) },
                      { label: t("reports.booksOnIssue"), value: String(overview.library.issued) },
                      { label: t("reports.vehicles"), value: String(overview.transport.vehicles) },
                      { label: t("reports.transportRoutes"), value: String(overview.transport.routes) },
                      { label: t("reports.studentsOnTransport"), value: String(overview.transport.assigned) },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span className="text-slate-600">{row.label}</span>
                        <span className="font-semibold text-slate-800">{row.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* ============ STUDENTS ============ */}
      {tab === "students" && (
        <>
          {studentsQuery.isLoading ? (
            <Card><CardContent><LoadingState label={t("reports.loadingStudents")} /></CardContent></Card>
          ) : studentsQuery.isError || !studentReport ? (
            <Card><CardContent><ErrorState message={t("reports.loadErrorStudents")} onRetry={() => studentsQuery.refetch()} /></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title={t("reports.totalStudents")} value={String(studentReport.total)} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
                <StatCard title={t("reports.male")} value={String(studentReport.gender.find((g) => g.gender === "MALE")?.count ?? 0)} icon={<GraduationCap className="h-5 w-5" />} iconBg="bg-sky-50 text-sky-600" />
                <StatCard title={t("reports.female")} value={String(studentReport.gender.find((g) => g.gender === "FEMALE")?.count ?? 0)} icon={<GraduationCap className="h-5 w-5" />} iconBg="bg-pink-50 text-pink-600" />
                <StatCard title={t("common.active")} value={String(studentReport.status.find((s) => s.status === "ACTIVE")?.count ?? 0)} change={t("reports.inactiveCount", { n: studentReport.status.find((s) => s.status === "INACTIVE")?.count ?? 0 })} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-50 text-emerald-600" />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("reports.admissionsTitle")}</CardTitle>
                    <CardDescription>{t("reports.admissionsDesc")}</CardDescription>
                  </div>
                  <ExportButton
                    label={t("reports.csv")}
                    onClick={() =>
                      downloadCSV("admissions.csv", [t("common.month"), t("reports.admissions")], studentReport.admissions.map((a) => [a.label, a.count]), t)
                    }
                  />
                </CardHeader>
                <CardContent>
                  {studentReport.admissions.every((a) => a.count === 0) ? (
                    <EmptyState title={t("reports.noAdmissions")} description={t("reports.noAdmissionsDesc")} />
                  ) : (
                    <MiniBars data={studentReport.admissions} valueKey="count" max={Math.max(1, ...studentReport.admissions.map((a) => a.count))} />
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t("reports.byClassTitle")}</CardTitle>
                      <CardDescription>{t("reports.byClassDesc2")}</CardDescription>
                    </div>
                    <ExportButton
                      label={t("reports.csv")}
                      onClick={() =>
                        downloadCSV("students-by-class.csv", [t("reports.class"), t("common.total"), t("common.active")], studentReport.byClass.map((c) => [c.className, c.total, c.active]), t)
                      }
                    />
                  </CardHeader>
                  <CardContent>
                    {studentReport.byClass.length === 0 ? (
                      <EmptyState title={t("reports.noClasses")} description={t("reports.classesEmptyDesc")} />
                    ) : (
                      <div className="space-y-3">
                        {studentReport.byClass.map((c) => (
                          <BarRow key={c.className} label={t("reports.classActiveLabel", { name: c.className, active: c.active })} value={c.total} max={maxClassStudents} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("reports.studentStatus")}</CardTitle>
                    <CardDescription>{t("reports.studentStatusDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {studentReport.status.every((s) => s.count === 0) ? (
                      <EmptyState title={t("reports.noStudents")} description={t("reports.statusEmptyDesc")} />
                    ) : (
                      <div className="space-y-3">
                        {studentReport.status
                          .filter((s) => s.count > 0)
                          .map((s) => (
                            <BarRow
                              key={s.status}
                              label={s.status}
                              value={s.count}
                              max={Math.max(1, ...studentReport.status.map((x) => x.count))}
                              color={s.status === "ACTIVE" ? "bg-green-500" : s.status === "INACTIVE" ? "bg-slate-400" : "bg-amber-500"}
                            />
                          ))}
                        {studentReport.status.every((s) => s.count === 0) && null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* ============ ATTENDANCE ============ */}
      {tab === "attendance" && (
        <>
          {attendanceQuery.isLoading ? (
            <Card><CardContent><LoadingState label={t("reports.loadingAttendance")} /></CardContent></Card>
          ) : attendanceQuery.isError || !attReport ? (
            <Card><CardContent><ErrorState message={t("reports.loadErrorAttendance")} onRetry={() => attendanceQuery.refetch()} /></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title={t("reports.rateStatTitle", { month: monthLabels[attReport.month - 1], year: attReport.year })} value={fmtPct(attReport.overall.rate)} icon={<CalendarCheck className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
                <StatCard title={t("reports.present")} value={String(attReport.overall.present)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-50 text-emerald-600" />
                <StatCard title={t("reports.absent")} value={String(attReport.overall.absent)} icon={<TrendingDown className="h-5 w-5" />} iconBg="bg-red-50 text-red-600" />
                <StatCard title={t("reports.totalRecords")} value={String(attReport.overall.total)} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("reports.dailyAttendanceTitle", { month: monthLabels[attReport.month - 1], year: attReport.year })}</CardTitle>
                    <CardDescription>{t("reports.dailyAttendanceDesc")}</CardDescription>
                  </div>
                  <ExportButton
                    label={t("reports.csv")}
                    onClick={() =>
                      downloadCSV(`attendance-${attReport.year}-${attReport.month}.csv`, [t("common.date"), t("reports.present"), t("common.total"), t("reports.ratePercent")], attReport.daily.filter((d) => d.total > 0).map((d) => [d.label, d.present, d.total, d.rate ?? ""]), t)
                    }
                  />
                </CardHeader>
                <CardContent>
                  {attReport.overall.total === 0 ? (
                    <EmptyState title={t("reports.noAttendance")} description={t("reports.noAttendanceDesc")} />
                  ) : (
                    <MiniBars data={attReport.daily.filter((d) => d.total > 0)} valueKey="total" max={maxAttendance} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("reports.attendanceByClass")}</CardTitle>
                  <CardDescription>{t("reports.attendanceByClassDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {attReport.byClass.length === 0 ? (
                    <EmptyState title={t("reports.noData")} description={t("reports.attendanceByClassEmptyDesc")} />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("reports.class")}</TableHead>
                            <TableHead>{t("reports.records")}</TableHead>
                            <TableHead>{t("reports.present")}</TableHead>
                            <TableHead>{t("reports.rate")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attReport.byClass.map((c) => (
                            <TableRow key={c.className}>
                              <TableCell className="font-medium text-slate-800">{c.className}</TableCell>
                              <TableCell className="text-slate-500">{c.total}</TableCell>
                              <TableCell className="text-slate-600">{c.present}</TableCell>
                              <TableCell className={`font-semibold ${rateColor(c.rate)}`}>{fmtPct(c.rate)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ============ FINANCE ============ */}
      {tab === "finance" && (
        <>
          {financeQuery.isLoading ? (
            <Card><CardContent><LoadingState label={t("reports.loadingFinance")} /></CardContent></Card>
          ) : financeQuery.isError || !finReport ? (
            <Card><CardContent><ErrorState message={t("reports.loadErrorFinance")} onRetry={() => financeQuery.refetch()} /></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title={t("reports.collectedStatTitle", { year: finReport.year })} value={cur(finReport.collected)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-50 text-emerald-600" />
                <StatCard title={t("reports.outstanding")} value={cur(finReport.outstanding)} icon={<Wallet className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
                <StatCard title={t("reports.overdueInvoices")} value={String(finReport.overdue)} icon={<TrendingDown className="h-5 w-5" />} iconBg="bg-red-50 text-red-600" />
                <StatCard title={t("reports.totalInvoices")} value={String(finReport.invoiceCount)} icon={<FileTextIcon />} iconBg="bg-blue-50 text-blue-600" />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("reports.feeCollectionsTitle", { year: finReport.year })}</CardTitle>
                    <CardDescription>{t("reports.feeCollectionsDesc")}</CardDescription>
                  </div>
                  <ExportButton
                    label={t("reports.csv")}
                    onClick={() =>
                      downloadCSV(`fee-collections-${finReport.year}.csv`, [t("common.month"), t("reports.payments"), t("reports.collected")], finReport.monthly.map((m) => [m.label, m.count, m.collected]), t)
                    }
                  />
                </CardHeader>
                <CardContent>
                  {finReport.monthly.every((m) => m.collected === 0) ? (
                    <EmptyState title={t("reports.noCollections")} description={t("reports.noCollectionsDesc")} />
                  ) : (
                    <MiniBars data={finReport.monthly} valueKey="collected" max={maxFinance} />
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t("reports.outstandingByClass")}</CardTitle>
                      <CardDescription>{t("reports.outstandingByClassDesc")}</CardDescription>
                    </div>
                    <ExportButton
                      label={t("reports.csv")}
                      onClick={() =>
                        downloadCSV(`outstanding-${finReport.year}.csv`, [t("reports.class"), t("reports.billed"), t("reports.collected"), t("reports.outstanding")], finReport.outstandingByClass.map((c) => [c.className, c.billed, c.collected, c.outstanding]), t)
                      }
                    />
                  </CardHeader>
                  <CardContent>
                    {finReport.outstandingByClass.length === 0 ? (
                      <EmptyState title={t("reports.noInvoices")} description={t("reports.outstandingEmptyDesc")} />
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("reports.class")}</TableHead>
                              <TableHead>{t("reports.collected")}</TableHead>
                              <TableHead>{t("reports.outstanding")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {finReport.outstandingByClass.map((c) => (
                              <TableRow key={c.className}>
                                <TableCell className="font-medium text-slate-800">{c.className}</TableCell>
                                <TableCell className="text-green-700">{cur(c.collected)}</TableCell>
                                <TableCell className={`font-semibold ${c.outstanding > 0 ? "text-amber-600" : "text-slate-500"}`}>{cur(c.outstanding)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("reports.invoiceStatus")}</CardTitle>
                    <CardDescription>{t("reports.invoiceStatusDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {finReport.status.every((s) => s.count === 0) ? (
                      <EmptyState title={t("reports.noInvoices")} description={t("reports.statusEmptyDesc")} />
                    ) : (
                      <div className="space-y-3">
                        {finReport.status.map((s) => (
                          <div key={s.status} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={s.status === "PAID" ? "success" : s.status === "OVERDUE" ? "danger" : s.status === "PARTIAL" ? "warning" : "secondary"}>{s.status}</Badge>
                              <span className="text-xs text-slate-400">{s.count} {s.count === 1 ? t("reports.invoiceOne") : t("reports.invoicesMany")}</span>
                            </div>
                            <span className={`text-sm font-semibold ${s.status === "PAID" ? "text-green-700" : s.status === "OVERDUE" ? "text-red-700" : "text-slate-700"}`}>{cur(s.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* ============ HR ============ */}
      {tab === "hr" && (
        <>
          {hrQuery.isLoading ? (
            <Card><CardContent><LoadingState label={t("reports.loadingHr")} /></CardContent></Card>
          ) : hrQuery.isError || !hrReport ? (
            <Card><CardContent><ErrorState message={t("reports.loadErrorHr")} onRetry={() => hrQuery.refetch()} /></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title={t("reports.staff")} value={String(hrReport.total)} change={t("reports.activeCount", { n: hrReport.active })} icon={<Briefcase className="h-5 w-5" />} iconBg="bg-purple-50 text-purple-600" />
                <StatCard title={t("reports.avgSalary")} value={cur(hrReport.avgSalary)} icon={<Wallet className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
                <StatCard title={t("reports.payrollStatTitle", { month: monthLabels[hrReport.payroll.month - 1] })} value={cur(hrReport.payroll.totalNet)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-50 text-emerald-600" />
                <StatCard title={t("reports.pendingSlips")} value={String(hrReport.payroll.pending)} change={t("reports.paidOfCount", { paid: hrReport.payroll.paid, count: hrReport.payroll.count })} icon={<TrendingDown className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("reports.staffByDepartment")}</CardTitle>
                    <CardDescription>{t("reports.staffByDepartmentDesc")}</CardDescription>
                  </div>
                  <ExportButton
                    label={t("reports.csv")}
                    onClick={() =>
                      downloadCSV("staff-by-department.csv", [t("reports.department"), t("reports.staff")], hrReport.byDepartment.map((d) => [d.department, d.count]), t)
                    }
                  />
                </CardHeader>
                <CardContent>
                  {hrReport.byDepartment.length === 0 ? (
                    <EmptyState title={t("reports.noStaffDepartments")} description={t("reports.staffDepartmentEmptyDesc")} />
                  ) : (
                    <div className="space-y-3">
                      {hrReport.byDepartment.map((d) => (
                        <BarRow key={d.department} label={d.department} value={d.count} max={maxDept} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("reports.payrollBreakdownTitle", { month: monthLabels[hrReport.payroll.month - 1], year: hrReport.payroll.year })}</CardTitle>
                    <CardDescription>{t("reports.payrollBreakdownDesc")}</CardDescription>
                  </div>
                  <ExportButton
                    label={t("reports.csv")}
                    onClick={() =>
                      downloadCSV(`payroll-${hrReport.payroll.year}-${hrReport.payroll.month}.csv`, [t("common.month"), t("reports.slips"), t("common.total"), t("common.pending")], [[`${monthLabels[hrReport.payroll.month - 1]} ${hrReport.payroll.year}`, hrReport.payroll.count, hrReport.payroll.totalNet, hrReport.payroll.pending]], t)
                    }
                  />
                </CardHeader>
                <CardContent>
                  {hrReport.payroll.count === 0 ? (
                    <EmptyState title={t("reports.noPayroll")} description={t("reports.noPayrollDesc")} />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("common.month")}</TableHead>
                            <TableHead>{t("reports.slips")}</TableHead>
                            <TableHead>{t("reports.paid")}</TableHead>
                            <TableHead>{t("common.pending")}</TableHead>
                            <TableHead>{t("reports.netTotal")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium text-slate-800">{monthLabels[hrReport.payroll.month - 1]} {hrReport.payroll.year}</TableCell>
                            <TableCell className="text-slate-500">{hrReport.payroll.count}</TableCell>
                            <TableCell className="text-green-700">{hrReport.payroll.paid}</TableCell>
                            <TableCell className="text-amber-700">{hrReport.payroll.pending}</TableCell>
                            <TableCell className="font-semibold text-slate-800">{cur(hrReport.payroll.totalNet)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ============ LIBRARY ============ */}
      {tab === "library" && (
        <>
          {libraryQuery.isLoading ? (
            <Card><CardContent><LoadingState label={t("reports.loadingLibrary")} /></CardContent></Card>
          ) : libraryQuery.isError || !libReport ? (
            <Card><CardContent><ErrorState message={t("reports.loadErrorLibrary")} onRetry={() => libraryQuery.refetch()} /></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title={t("reports.booksTitles")} value={String(libReport.books)} change={t("reports.copiesCount", { n: libReport.totalCopies })} icon={<Library className="h-5 w-5" />} iconBg="bg-purple-50 text-purple-600" />
                <StatCard title={t("reports.copiesAvailable")} value={String(libReport.availableCopies)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-50 text-emerald-600" />
                <StatCard title={t("reports.booksOnIssue")} value={String(libReport.issued)} icon={<Library className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
                <StatCard title={t("reports.overdue")} value={String(libReport.overdue)} change={libReport.overdue ? t("reports.actionNeeded") : undefined} icon={<TrendingDown className="h-5 w-5" />} iconBg="bg-red-50 text-red-600" />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("reports.issuedByCategory")}</CardTitle>
                    <CardDescription>{t("reports.issuedByCategoryDesc")}</CardDescription>
                  </div>
                  <ExportButton
                    label={t("reports.csv")}
                    onClick={() =>
                      downloadCSV("library-by-category.csv", [t("reports.category"), t("reports.issued")], libReport.byCategory.map((c) => [c.category, c.issued]), t)
                    }
                  />
                </CardHeader>
                <CardContent>
                  {libReport.byCategory.length === 0 ? (
                    <EmptyState title={t("reports.noIssues")} description={t("reports.noIssuesDesc")} />
                  ) : (
                    <div className="space-y-3">
                      {libReport.byCategory.map((c) => (
                        <BarRow key={c.category} label={c.category} value={c.issued} max={maxLibCat} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("reports.recentIssues")}</CardTitle>
                    <CardDescription>{t("reports.recentIssuesDesc")}</CardDescription>
                  </div>
                  <ExportButton
                    label={t("reports.csv")}
                    onClick={() =>
                      downloadCSV("library-recent.csv", [t("reports.book"), t("reports.category"), t("reports.student"), t("reports.issueDate"), t("reports.dueDate"), t("common.status")], libReport.recent.map((r) => [r.book, r.category, r.student, fmtDate(r.issueDate), fmtDate(r.dueDate), r.status]), t)
                    }
                  />
                </CardHeader>
                <CardContent>
                  {libReport.recent.length === 0 ? (
                    <EmptyState title={t("reports.noBookIssues")} description={t("reports.noBookIssuesDesc")} />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("reports.book")}</TableHead>
                            <TableHead>{t("reports.student")}</TableHead>
                            <TableHead>{t("reports.due")}</TableHead>
                            <TableHead>{t("common.status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {libReport.recent.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>
                                <p className="font-medium text-slate-800">{r.book}</p>
                                <p className="text-xs text-slate-400">{r.category}</p>
                              </TableCell>
                              <TableCell className="text-slate-600">{r.student}</TableCell>
                              <TableCell className="text-slate-500">{fmtDate(r.dueDate)}</TableCell>
                              <TableCell>{r.status === "OVERDUE" ? <Badge variant="danger">{t("reports.overdue")}</Badge> : <Badge variant="secondary">{r.status}</Badge>}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ============ TRANSPORT ============ */}
      {tab === "transport" && (
        <>
          {transportQuery.isLoading ? (
            <Card><CardContent><LoadingState label={t("reports.loadingTransport")} /></CardContent></Card>
          ) : transportQuery.isError || !transpReport ? (
            <Card><CardContent><ErrorState message={t("reports.loadErrorTransport")} onRetry={() => transportQuery.refetch()} /></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title={t("reports.vehicles")} value={String(transpReport.vehicles)} icon={<Bus className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
                <StatCard title={t("reports.routes")} value={String(transpReport.routes)} icon={<Bus className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
                <StatCard title={t("reports.studentsAssigned")} value={String(transpReport.assigned)} icon={<Users className="h-5 w-5" />} iconBg="bg-purple-50 text-purple-600" />
                <StatCard title={t("reports.avgStudentsPerRoute")} value={transpReport.routes ? String(Math.round(transpReport.assigned / transpReport.routes)) : "0"} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-50 text-emerald-600" />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("reports.routesAssignments")}</CardTitle>
                    <CardDescription>{t("reports.routesAssignmentsDesc")}</CardDescription>
                  </div>
                  <ExportButton
                    label={t("reports.csv")}
                    onClick={() =>
                      downloadCSV("transport-routes.csv", [t("reports.route"), t("reports.vehicle"), t("reports.stops"), t("reports.students")], transpReport.byRoute.map((r) => [r.routeName, r.vehicle, r.stops, r.students]), t)
                    }
                  />
                </CardHeader>
                <CardContent>
                  {transpReport.byRoute.length === 0 ? (
                    <EmptyState title={t("reports.noRoutes")} description={t("reports.noRoutesDesc")} />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("reports.route")}</TableHead>
                            <TableHead>{t("reports.vehicle")}</TableHead>
                            <TableHead>{t("reports.stops")}</TableHead>
                            <TableHead>{t("reports.students")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transpReport.byRoute.map((r) => (
                            <TableRow key={r.routeName}>
                              <TableCell className="font-medium text-slate-800">{r.routeName}</TableCell>
                              <TableCell className="font-mono text-xs text-slate-500">{r.vehicle}</TableCell>
                              <TableCell className="text-slate-600">{r.stops}</TableCell>
                              <TableCell className="font-semibold text-slate-800">{r.students}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function FileTextIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default ReportsPage;