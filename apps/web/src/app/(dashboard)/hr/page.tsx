"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Briefcase,
  CalendarClock,
  Banknote,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  UserRound,
  Building2,
  CalendarDays,
  Wallet,
  IdCard,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
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
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";

/* ================= Types ================= */

interface HREmployee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  joiningDate?: string | null;
  salary?: number | null;
  schoolId?: string;
  status?: string;
  _count?: { payroll: number; leaveRequests: number };
  leaveRequests?: { id: string; type: string; startDate: string; endDate: string }[];
}

interface HRDepartment {
  id: string;
  name: string;
  code: string;
  schoolId?: string;
  headId?: string | null;
  headName?: string | null;
}

interface HRLeave {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: string;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: string | null;
    designation?: string | null;
  };
}

interface HRPayroll {
  id: string;
  month: number;
  year: number;
  basicSalary: number | null;
  deductions: number | null;
  bonuses: number | null;
  netSalary: number | null;
  status: string;
  paidAt?: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: string | null;
    designation?: string | null;
  };
}

interface HRStats {
  totalEmployees: number;
  departments: number;
  active: number;
  onLeaveToday: number;
  pendingLeaves: number;
  monthlyPayroll: { count: number; totalNet: number | null };
  recentLeaves: HRLeave[];
}

const MONTH_KEYS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const cur = (v?: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const leaveStatusKey = (status: string) => {
  switch (status) {
    case "APPROVED": return "hr.statusApproved";
    case "REJECTED": return "hr.statusRejected";
    case "CANCELLED": return "hr.statusCancelled";
    default: return "common.pending";
  }
};

const empStatusBadge = (t: Translate, status?: string) => {
  switch (status) {
    case "ACTIVE": return <Badge variant="success">{t("common.active")}</Badge>;
    case "ON_LEAVE": return <Badge variant="warning">{t("hr.statusOnLeave")}</Badge>;
    case "INACTIVE": return <Badge variant="secondary">{t("common.inactive")}</Badge>;
    case "TERMINATED": return <Badge variant="danger">{t("hr.statusTerminated")}</Badge>;
    default: return <Badge variant="secondary">{status || "—"}</Badge>;
  }
};

const leaveStatusBadge = (t: Translate, status: string) => {
  switch (status) {
    case "APPROVED": return <Badge variant="success">{t("hr.statusApproved")}</Badge>;
    case "REJECTED": return <Badge variant="danger">{t("hr.statusRejected")}</Badge>;
    case "CANCELLED": return <Badge variant="secondary">{t("hr.statusCancelled")}</Badge>;
    default: return <Badge variant="warning">{t("common.pending")}</Badge>;
  }
};

const initials = (e: { firstName: string; lastName: string }) =>
  `${e.firstName[0] || ""}${e.lastName[0] || ""}`.toUpperCase();

const leaveDays = (start: string, end: string) =>
  Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);

/* ================= UI helpers ================= */

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

interface SchoolOption {
  id: string;
  name: string;
  schoolCode: string;
}

/* ================= Employee modal ================= */

function EmployeeModal({
  employee,
  departments,
  isSuperAdmin,
  schools,
  selectedSchoolId,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  employee?: HREmployee;
  departments: string[];
  isSuperAdmin?: boolean;
  schools?: SchoolOption[];
  selectedSchoolId?: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [form, setForm] = useState({
    employeeId: employee?.employeeId || "",
    firstName: employee?.firstName || "",
    lastName: employee?.lastName || "",
    phone: employee?.phone || "",
    email: employee?.email || "",
    department: employee?.department || "",
    designation: employee?.designation || "",
    joiningDate: employee?.joiningDate ? employee.joiningDate.slice(0, 10) : "",
    salary: employee?.salary != null ? String(employee.salary) : "",
    status: employee?.status || "ACTIVE",
    schoolId: employee?.schoolId || selectedSchoolId || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModalShell
      title={employee ? "Edit Employee" : "Add Employee"}
      subtitle={employee ? "Update staff record" : "Register staff in the school directory"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            employeeId: form.employeeId.trim().toUpperCase() || undefined,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            department: form.department.trim() || null,
            designation: form.designation.trim() || null,
            joiningDate: form.joiningDate || null,
            salary: form.salary.trim() === "" ? null : Math.max(0, Number(form.salary)),
            status: form.status,
            ...(isSuperAdmin ? { schoolId: form.schoolId } : {}),
          });
        }}
        className="grid gap-4 p-6"
      >
        {isSuperAdmin && (
          <Field label="School *" hint="The employee will be registered under this school">
            <Select value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)} required>
              <option value="" disabled>Select a school</option>
              {(schools || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee ID" hint="Leave blank to auto-generate (e.g. EMP001)">
            <Input value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} placeholder="EMP001" />
          </Field>
          <Field label={employee ? "Status" : " "}>
            <Select value={form.status} onChange={(e) => set("status", e.target.value)} disabled={!employee}>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TERMINATED">Terminated</option>
            </Select>
          </Field>
          <Field label="First Name *">
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </Field>
          <Field label="Last Name *">
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@school.edu" />
          </Field>
          <Field label="Department">
            <Input list="hr-dept-list" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Mathematics" />
            <datalist id="hr-dept-list">
              {departments.map((d) => <option key={d} value={d} />)}
            </datalist>
          </Field>
          <Field label="Designation">
            <Input value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Senior Teacher" />
          </Field>
          <Field label="Joining Date">
            <Input type="date" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
          </Field>
          <Field label="Monthly Salary (₹)">
            <Input type="number" min={0} value={form.salary} onChange={(e) => set("salary", e.target.value)} placeholder="45000" />
          </Field>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {employee ? "Save Changes" : "Add Employee"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ================= Department modal ================= */

function DepartmentModal({
  department,
  employees,
  isSuperAdmin,
  schools,
  selectedSchoolId,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  department?: HRDepartment;
  employees: HREmployee[];
  isSuperAdmin?: boolean;
  schools?: SchoolOption[];
  selectedSchoolId?: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [form, setForm] = useState({
    name: department?.name || "",
    code: department?.code || "",
    headId: department?.headId || "",
    schoolId: department?.schoolId || selectedSchoolId || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModalShell
      title={department ? "Edit Department" : "Add Department"}
      subtitle="Organise staff into school departments"
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: form.name.trim(),
            code: form.code.trim().toUpperCase(),
            headId: form.headId || null,
            ...(isSuperAdmin ? { schoolId: form.schoolId } : {}),
          });
        }}
        className="grid gap-4 p-6"
      >
        {isSuperAdmin && (
          <Field label="School *">
            <Select value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)} required>
              <option value="" disabled>Select a school</option>
              {(schools || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department Name *">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Mathematics" required />
          </Field>
          <Field label="Code *" hint="Short unique code used for reference">
            <Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="MATH" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Department Head" hint="Optional — choose an employee">
              <Select value={form.headId} onChange={(e) => set("headId", e.target.value)}>
                <option value="">Not assigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.department || emp.designation || "Staff"})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {department ? "Save Changes" : "Add Department"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ================= Leave modal ================= */

function LeaveModal({
  employees,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  employees: HREmployee[];
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [form, setForm] = useState({
    employeeId: "",
    type: "Casual",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const days =
    form.startDate && form.endDate
      ? leaveDays(form.startDate, form.endDate)
      : form.startDate && !form.endDate
      ? 1
      : 0;

  return (
    <ModalShell title="New Leave Request" subtitle="Record leave for a staff member" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            employeeId: form.employeeId,
            type: form.type.trim(),
            startDate: form.startDate,
            endDate: form.endDate,
            reason: form.reason.trim() || null,
          });
        }}
        className="grid gap-4 p-6"
      >
        <Field label="Employee *">
          <Select value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} required>
            <option value="" disabled>Select an employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} · {emp.employeeId}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Leave Type *">
          <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option>Casual</option>
            <option>Sick</option>
            <option>Earned</option>
            <option>Medical</option>
            <option>Maternity</option>
            <option>Study</option>
            <option>Unpaid</option>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start Date *">
            <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required />
          </Field>
          <Field label="End Date *" hint={days > 0 ? `${days} day(s)` : undefined}>
            <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} required />
          </Field>
        </div>
        <Field label="Reason">
          <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Reason for leave" />
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isLoading || !form.employeeId}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
/* ================= Main page ================= */

type HRTab = "overview" | "employees" | "departments" | "leave" | "payroll";

function HRDashboard() {
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

  const canView = has("hr.view");
  const canCreate = has("hr.create");
  const canEdit = has("hr.edit");
  const canPayrollView = has("payroll.view");
  const canPayrollManage = has("payroll.manage");

  const [tab, setTab] = useState<HRTab>("overview");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const schoolId = isSuperAdmin ? selectedSchoolId : user?.schoolId || "";

  const [employeeModal, setEmployeeModal] = useState<{ open: boolean; employee?: HREmployee }>({ open: false });
  const [departmentModal, setDepartmentModal] = useState<{ open: boolean; department?: HRDepartment }>({ open: false });
  const [leaveModal, setLeaveModal] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [leaveFilter, setLeaveFilter] = useState("");
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());

  const queryClient = useQueryClient();

  const TABS: { id: HRTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: t("hr.tabOverview"), icon: <Users className="h-4 w-4" /> },
    { id: "employees", label: t("hr.tabEmployees"), icon: <UserRound className="h-4 w-4" /> },
    { id: "departments", label: t("hr.tabDepartments"), icon: <Building2 className="h-4 w-4" /> },
    { id: "leave", label: t("hr.tabLeave"), icon: <CalendarDays className="h-4 w-4" /> },
    { id: "payroll", label: t("hr.tabPayroll"), icon: <Wallet className="h-4 w-4" /> },
  ];

  const monthLabels = useMemo(() => MONTH_KEYS.map((m) => t(`hr.month${m}`)), [t]);

  const schoolsQuery = useQuery({
    queryKey: ["hr-schools"],
    queryFn: async () => {
      const res = await api.get("/schools", { params: { limit: 100 } });
      return res.data.data as { id: string; name: string; schoolCode: string }[];
    },
    enabled: isSuperAdmin,
  });

  const statsQuery = useQuery({
    queryKey: ["hr-stats", schoolId],
    queryFn: async () => {
      const res = await api.get("/hr/dashboard", { params: schoolId ? { schoolId } : {} });
      return res.data.data as HRStats;
    },
    enabled: canView,
  });

  const employeesQuery = useQuery({
    queryKey: ["hr-employees", schoolId],
    queryFn: async () => {
      const res = await api.get("/hr/employees", { params: schoolId ? { schoolId } : {} });
      return res.data.data as HREmployee[];
    },
    enabled: canView,
  });

  const departmentsQuery = useQuery({
    queryKey: ["hr-departments", schoolId],
    queryFn: async () => {
      const res = await api.get("/hr/departments", { params: schoolId ? { schoolId } : {} });
      return res.data.data as HRDepartment[];
    },
    enabled: canView,
  });

  const leavesQuery = useQuery({
    queryKey: ["hr-leaves", schoolId],
    queryFn: async () => {
      const res = await api.get("/hr/leaves", { params: schoolId ? { schoolId } : {} });
      return res.data.data as HRLeave[];
    },
    enabled: canView,
  });

  const payrollQuery = useQuery({
    queryKey: ["hr-payroll", schoolId, payrollMonth, payrollYear],
    queryFn: async () => {
      const res = await api.get("/hr/payroll", {
        params: { month: payrollMonth, year: payrollYear, ...(schoolId ? { schoolId } : {}) },
      });
      return res.data.data as HRPayroll[];
    },
    enabled: canPayrollView,
  });

  const employees = employeesQuery.data || [];
  const departments = departmentsQuery.data || [];
  const departmentNames = Array.from(new Set(departments.map((d) => d.name)));
  const leaves = leavesQuery.data || [];
  const payroll = payrollQuery.data || [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
    queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
    queryClient.invalidateQueries({ queryKey: ["hr-departments"] });
    queryClient.invalidateQueries({ queryKey: ["hr-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["hr-payroll"] });
  };

  const saveEmployeeMutation = useMutation({
    mutationFn: async ({ employee, data }: { employee?: HREmployee; data: any }) => {
      if (employee) await api.put(`/hr/employees/${employee.id}`, data);
      else await api.post("/hr/employees", data);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.employee ? t("hr.employeeUpdated") : t("hr.employeeAdded"));
      setEmployeeModal({ open: false });
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/hr/employees/${id}`),
    onSuccess: () => { toast.success(t("hr.employeeRemoved")); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveDepartmentMutation = useMutation({
    mutationFn: async ({ department, data }: { department?: HRDepartment; data: any }) => {
      if (department) await api.put(`/hr/departments/${department.id}`, data);
      else await api.post("/hr/departments", data);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.department ? t("hr.departmentUpdated") : t("hr.departmentAdded"));
      setDepartmentModal({ open: false });
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/hr/departments/${id}`),
    onSuccess: () => { toast.success(t("hr.departmentRemoved")); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createLeaveMutation = useMutation({
    mutationFn: async (data: any) => api.post("/hr/leaves", data),
    onSuccess: () => { toast.success(t("hr.leaveSubmitted")); setLeaveModal(false); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const leaveStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.post(`/hr/leaves/${id}/status`, { status }),
    onSuccess: (_d, vars) => {
      toast.success(t("hr.leaveStatusToast", { status: t(leaveStatusKey(vars.status)) }));
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const generatePayrollMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/hr/payroll/generate", { month: payrollMonth, year: payrollYear, ...(schoolId ? { schoolId } : {}) });
      return (res.data.data as { created: number }).created;
    },
    onSuccess: (created) => {
      toast.success(t("hr.payrollGenerated", { month: monthLabels[payrollMonth - 1], year: payrollYear, count: created ?? 0 }));
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const payAllMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/hr/payroll/pay-all", { month: payrollMonth, year: payrollYear, ...(schoolId ? { schoolId } : {}) });
      return (res.data.data as { paid: number }).paid;
    },
    onSuccess: (paid) => {
      toast.success(t("hr.payrollRecordsPaid", { count: paid ?? 0 }));
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const payOneMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/hr/payroll/${id}/pay`),
    onSuccess: () => { toast.success(t("hr.payrollPaid")); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const stats = statsQuery.data;
  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.firstName, e.lastName, `${e.firstName} ${e.lastName}`, e.employeeId, e.department, e.designation, e.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [employees, employeeSearch]);

  const filteredLeaves = useMemo(() => {
    if (!leaveFilter) return leaves;
    return leaves.filter((l) => l.status === leaveFilter);
  }, [leaves, leaveFilter]);

  const pendingPayroll = payroll.filter((p) => p.status === "PENDING").length;
  const payrollTotal = payroll.reduce((sum, p) => sum + (p.netSalary ?? 0), 0);

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">{t("hr.noAccess")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.hr")}</h1>
          <p className="text-sm text-slate-500">{t("hr.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <Select value={selectedSchoolId} onChange={(e) => setSelectedSchoolId(e.target.value)} className="w-56">
              <option value="">{t("hr.allSchools")}</option>
              {(schoolsQuery.data || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          )}
          {tab === "employees" && canCreate && (
            <Button onClick={() => setEmployeeModal({ open: true })}>
              <Plus className="ms-2 h-4 w-4" />{t("hr.addEmployee")}
            </Button>
          )}
          {tab === "departments" && canCreate && (
            <Button onClick={() => setDepartmentModal({ open: true })}>
              <Plus className="ms-2 h-4 w-4" />{t("hr.addDepartment")}
            </Button>
          )}
          {tab === "leave" && canCreate && (
            <Button onClick={() => setLeaveModal(true)}>
              <Plus className="ms-2 h-4 w-4" />{t("hr.newLeave")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === tb.id ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={t("hr.statTotalEmployees")} value={String(stats?.totalEmployees ?? 0)} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
            <StatCard title={t("hr.statDepartments")} value={String(stats?.departments ?? 0)} icon={<Briefcase className="h-5 w-5" />} iconBg="bg-purple-50 text-purple-600" />
            <StatCard title={t("hr.statOnLeaveToday")} value={String(stats?.onLeaveToday ?? 0)} icon={<CalendarClock className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
            <StatCard title={t("hr.statMonthlyPayroll")} value={cur(stats?.monthlyPayroll?.totalNet)} change={t("hr.recordsCount", { count: stats?.monthlyPayroll?.count ?? 0 })} icon={<Banknote className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t("hr.employeeDirectory")}</CardTitle>
                  <CardDescription>{t("hr.staffDesc")}</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTab("employees")}>{t("hr.viewAll")}</Button>
              </CardHeader>
              <CardContent>
                {employeesQuery.isLoading ? (
                  <LoadingState label={t("hr.loadingEmployees")} />
                ) : employeesQuery.isError ? (
                  <ErrorState message={t("hr.loadFailedEmployees")} onRetry={() => employeesQuery.refetch()} />
                ) : employees.length === 0 ? (
                  <EmptyState title={t("hr.noEmployees")} description={t("hr.addFirstEmployee")} action={canCreate ? <Button onClick={() => setEmployeeModal({ open: true })}><Plus className="ms-2 h-4 w-4" />{t("hr.addEmployee")}</Button> : undefined} />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("hr.colEmployee")}</TableHead>
                          <TableHead>{t("hr.colDepartment")}</TableHead>
                          <TableHead>{t("hr.colDesignation")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.slice(0, 6).map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">{initials(emp)}</div>
                                <div>
                                  <p className="font-medium text-slate-800">{emp.firstName} {emp.lastName}</p>
                                  <p className="text-xs text-slate-400">{emp.employeeId}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-600">{emp.department || "—"}</TableCell>
                            <TableCell className="text-slate-600">{emp.designation || "—"}</TableCell>
                            <TableCell>{empStatusBadge(t, emp.status)}</TableCell>
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
                <CardTitle className="text-base">{t("hr.recentLeaveRequests")}</CardTitle>
                <CardDescription>{t("hr.staffLeaveActivity")}</CardDescription>
              </CardHeader>
              <CardContent>
                {statsQuery.isLoading ? (
                  <LoadingState label={t("common.loading")} />
                ) : (stats?.recentLeaves || []).length === 0 ? (
                  <EmptyState title={t("hr.noLeaveRequests")} description={t("hr.noLeaveRequestsDesc")} />
                ) : (
                  <div className="space-y-3">
                    {(stats?.recentLeaves || []).map((l) => (
                      <div key={l.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{l.employee.firstName} {l.employee.lastName}</p>
                          <p className="text-xs text-slate-500">{l.type} · {fmtDate(l.startDate)} – {fmtDate(l.endDate)}</p>
                        </div>
                        {leaveStatusBadge(t, l.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {tab === "employees" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{t("hr.employeeDirectory")}</CardTitle>
                <CardDescription>{t("hr.allStaffDesc")}</CardDescription>
              </div>
              <div className="relative sm:w-72">
                <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder={t("hr.searchEmployees")}
                  className="ps-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {employeesQuery.isLoading ? (
              <LoadingState label={t("hr.loadingEmployees")} />
            ) : employeesQuery.isError ? (
              <ErrorState message={t("hr.loadFailedEmployees")} onRetry={() => employeesQuery.refetch()} />
            ) : filteredEmployees.length === 0 ? (
              <EmptyState title={employeeSearch ? t("hr.noEmployeeMatches") : t("hr.noEmployees")} description={employeeSearch ? t("hr.tryDifferentSearch") : t("hr.addFirstEmployeeStart")} action={!employeeSearch && canCreate ? <Button onClick={() => setEmployeeModal({ open: true })}><Plus className="ms-2 h-4 w-4" />{t("hr.addEmployee")}</Button> : undefined} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("hr.colEmployee")}</TableHead>
                      <TableHead>{t("hr.colDepartment")}</TableHead>
                      <TableHead>{t("hr.colDesignation")}</TableHead>
                      <TableHead>{t("hr.colJoined")}</TableHead>
                      <TableHead>{t("hr.colSalary")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      {canEdit && <TableHead className="text-end">{t("common.actions")}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">{initials(emp)}</div>
                            <div>
                              <p className="font-medium text-slate-800">{emp.firstName} {emp.lastName}</p>
                              <p className="text-xs text-slate-400">
{emp.employeeId}
                                  {emp.leaveRequests && emp.leaveRequests.length > 0 && (
                                    <span className="ms-1 text-amber-600">· {t("hr.onLeaveUntil", { date: fmtDate(emp.leaveRequests[0].endDate) })}</span>
                                  )}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">{emp.department || "—"}</TableCell>
                        <TableCell className="text-slate-600">{emp.designation || "—"}</TableCell>
                        <TableCell className="text-slate-500">{fmtDate(emp.joiningDate)}</TableCell>
                        <TableCell className="font-medium text-slate-700">{cur(emp.salary)}</TableCell>
                        <TableCell>{empStatusBadge(t, emp.status)}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setEmployeeModal({ open: true, employee: emp })}>
                                <Pencil className="h-4 w-4 text-slate-500" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50"
                                disabled={deleteEmployeeMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(`Remove ${emp.firstName} ${emp.lastName} from the directory? Their leave and payroll records will be deleted too.`)) {
                                    deleteEmployeeMutation.mutate(emp.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "departments" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departmentsQuery.isLoading ? (
              <Card className="sm:col-span-2 lg:col-span-3"><CardContent><LoadingState label="Loading departments..." /></CardContent></Card>
            ) : departmentsQuery.isError ? (
              <Card className="sm:col-span-2 lg:col-span-3"><CardContent><ErrorState message="Failed to load departments" onRetry={() => departmentsQuery.refetch()} /></CardContent></Card>
            ) : departments.length === 0 ? (
              <EmptyState title="No departments yet" description="Create departments to organise your staff." action={canCreate ? <Button onClick={() => setDepartmentModal({ open: true })}><Plus className="mr-2 h-4 w-4" />Add Department</Button> : undefined} />
            ) : (
              departments.map((d) => (
                <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDepartmentModal({ open: true, department: d })}>
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                          disabled={deleteDepartmentMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Remove department "${d.name}"?`)) deleteDepartmentMutation.mutate(d.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-800">{d.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">{d.code}</Badge>
                    {d.headName && <Badge variant="outline">Head: {d.headName}</Badge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === "leave" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Leave Requests</CardTitle>
                <CardDescription>Approve or reject staff leave</CardDescription>
              </div>
              <Select value={leaveFilter} onChange={(e) => setLeaveFilter(e.target.value)} className="w-44">
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {leavesQuery.isLoading ? (
              <LoadingState label="Loading leave requests..." />
            ) : leavesQuery.isError ? (
              <ErrorState message="Failed to load leave requests" onRetry={() => leavesQuery.refetch()} />
            ) : filteredLeaves.length === 0 ? (
              <EmptyState title="No leave requests" description={leaveFilter ? "No requests with this status." : "New leave requests will appear here."} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      {canEdit && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaves.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <p className="font-medium text-slate-800">{l.employee.firstName} {l.employee.lastName}</p>
                          <p className="text-xs text-slate-400">{l.employee.employeeId} · {l.employee.department || l.employee.designation || "Staff"}</p>
                        </TableCell>
                        <TableCell className="text-slate-600">{l.type}</TableCell>
                        <TableCell className="text-slate-500">{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</TableCell>
                        <TableCell className="font-medium text-slate-700">{leaveDays(l.startDate, l.endDate)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-500">{l.reason || "—"}</TableCell>
                        <TableCell>{leaveStatusBadge(t, l.status)}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            {l.status === "PENDING" ? (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50" disabled={leaveStatusMutation.isPending} onClick={() => leaveStatusMutation.mutate({ id: l.id, status: "APPROVED" })}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" disabled={leaveStatusMutation.isPending} onClick={() => leaveStatusMutation.mutate({ id: l.id, status: "REJECTED" })}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "payroll" && (
        <>
          {!canPayrollView ? (
            <Card><CardContent><EmptyState title="No access" description="You don't have payroll permissions." /></CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Payroll</CardTitle>
                      <CardDescription>Generate and manage monthly payroll records</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={String(payrollMonth)} onChange={(e) => setPayrollMonth(Number(e.target.value))} className="w-36">
                        {monthLabels.map((m: string, i: number) => <option key={m} value={i + 1}>{m}</option>)}
                      </Select>
                      <Input
                        type="number"
                        min={2000}
                        max={2100}
                        value={payrollYear}
                        onChange={(e) => setPayrollYear(Number(e.target.value))}
                        className="w-24"
                      />
                      {canPayrollManage && (
                        <>
                          <Button variant="outline" onClick={() => generatePayrollMutation.mutate()} disabled={generatePayrollMutation.isPending}>
                            {generatePayrollMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <IdCard className="mr-2 h-4 w-4" />}
                            Generate
                          </Button>
                          <Button
                            variant="outline"
                            className="border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => payAllMutation.mutate()}
                            disabled={payAllMutation.isPending || pendingPayroll === 0}
                          >
                            {payAllMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Pay All ({pendingPayroll})
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-500">Employees on payroll</p>
                      <p className="mt-1 text-lg font-semibold text-slate-800">{payroll.length}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-500">Total for {monthLabels[payrollMonth - 1]} {payrollYear}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-800">{cur(payrollTotal)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-500">Pending</p>
                      <p className="mt-1 text-lg font-semibold text-amber-600">{pendingPayroll}</p>
                    </div>
                  </div>
                  {payrollQuery.isLoading ? (
                    <LoadingState label="Loading payroll..." />
                  ) : payrollQuery.isError ? (
                    <ErrorState message="Failed to load payroll" onRetry={() => payrollQuery.refetch()} />
                  ) : payroll.length === 0 ? (
                    <EmptyState title="No payroll for this month" description="Click Generate to create draft payroll records for eligible employees." />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Basic</TableHead>
                            <TableHead>Deductions</TableHead>
                            <TableHead>Net</TableHead>
                            <TableHead>Status</TableHead>
                            {canPayrollManage && <TableHead className="text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payroll.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <p className="font-medium text-slate-800">{p.employee.firstName} {p.employee.lastName}</p>
                                <p className="text-xs text-slate-400">{p.employee.employeeId} · {p.employee.department || "—"}</p>
                              </TableCell>
                              <TableCell className="text-slate-600">{cur(p.basicSalary)}</TableCell>
                              <TableCell className="text-slate-500">{cur(p.deductions)}</TableCell>
                              <TableCell className="font-semibold text-slate-800">{cur(p.netSalary)}</TableCell>
                              <TableCell>
                                {p.status === "PAID" ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Pending</Badge>}
                              </TableCell>
                              {canPayrollManage && (
                                <TableCell className="text-right">
                                  {p.status === "PENDING" && (
                                    <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" disabled={payOneMutation.isPending} onClick={() => payOneMutation.mutate(p.id)}>
                                      {payOneMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                      Mark Paid
                                    </Button>
                                  )}
                                </TableCell>
                              )}
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

      {/* Modals */}
      {employeeModal.open && (
        <EmployeeModal
          employee={employeeModal.employee}
          departments={departmentNames}
          isSuperAdmin={isSuperAdmin}
          schools={schoolsQuery.data || []}
          selectedSchoolId={selectedSchoolId || undefined}
          isLoading={saveEmployeeMutation.isPending}
          error={saveEmployeeMutation.error ? getErrorMessage(saveEmployeeMutation.error) : undefined}
          onClose={() => setEmployeeModal({ open: false })}
          onSubmit={(data) => saveEmployeeMutation.mutate({ employee: employeeModal.employee, data })}
        />
      )}
      {departmentModal.open && (
        <DepartmentModal
          department={departmentModal.department}
          employees={employees}
          isSuperAdmin={isSuperAdmin}
          schools={schoolsQuery.data || []}
          selectedSchoolId={selectedSchoolId || undefined}
          isLoading={saveDepartmentMutation.isPending}
          error={saveDepartmentMutation.error ? getErrorMessage(saveDepartmentMutation.error) : undefined}
          onClose={() => setDepartmentModal({ open: false })}
          onSubmit={(data) => saveDepartmentMutation.mutate({ department: departmentModal.department, data })}
        />
      )}
      {leaveModal && (
        <LeaveModal
          employees={employees}
          isLoading={createLeaveMutation.isPending}
          error={createLeaveMutation.error ? getErrorMessage(createLeaveMutation.error) : undefined}
          onClose={() => setLeaveModal(false)}
          onSubmit={(data) => createLeaveMutation.mutate(data)}
        />
      )}
    </div>
  );
}

export default HRDashboard;