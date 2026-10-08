"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Building2,
  GraduationCap,
  Banknote,
  Layers,
  ChevronDown,
  ChevronUp,
  Receipt,
  FileText,
  CalendarDays,
  Download,
  Send,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
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
import { AY_MONTHS, downloadPdf, fmt, statusVariant } from "@/components/fees/shared";
import type { InvoiceStatus } from "@/components/fees/shared";
import { useI18n } from "@/components/language-provider";
import { AcademicYearsView } from "@/components/fees/academic-years-view";
import { StructuresView } from "@/components/fees/structures-view";
import { PendingReportView } from "@/components/fees/pending-report-view";

type FeeView = "overview" | "years" | "structures" | "reports";

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  discount: number;
  fine: number;
  status: InvoiceStatus;
  feeMonth?: number | null;
  feeYear?: number | null;
  academicYearId?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    class?: { id: string; name: string } | null;
  } | null;
  school?: { id: string; name: string } | null;
  _count: { payments: number };
  payments?: {
    id: string;
    amount: number;
    method: string;
    transactionId?: string | null;
    paidAt: string;
    status: string;
  }[];
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  discount: number;
  fine: number;
  status: InvoiceStatus;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
  school?: { id: string; name: string } | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    class?: { name: string } | null;
    section?: { name: string } | null;
  };
  items: { id: string; description: string; amount: number }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    transactionId?: string | null;
    paidAt: string;
    status: string;
  }[];
}

interface DashboardStats {
  totalFeesExpected: number;
  totalCollected: number;
  totalPending: number;
  currentMonthCollected: number;
  overdueInvoices: number;
  collectionRate: number;
  totalInvoices: number;
}

interface YearRow {
  id: string;
  name: string;
  isCurrent?: boolean;
}

const paymentMethods = ["CASH", "UPI", "BANK_TRANSFER", "CARD", "ONLINE", "RAZORPAY", "STRIPE", "CHEQUE", "OTHER"];

export default function FeesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";
  const roleName = user?.roleName;
  const canManage = isSuperAdmin || roleName === "SCHOOL_ADMIN" || roleName === "ACCOUNTANT";

  const [view, setView] = useState<FeeView>("overview");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [page, setPage] = useState(1);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payingFor, setPayingFor] = useState<Invoice | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [finingFor, setFiningFor] = useState<string | null>(null);
  const { t } = useI18n();

  const [schoolId, setSchoolId] = useState("");
  const [form, setForm] = useState({
    schoolId: "",
    classId: "",
    sectionId: "",
    studentId: "",
    amount: "",
    description: "",
    dueDate: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "CASH",
    transactionId: "",
  });
  const [bulk, setBulk] = useState({
    academicYearId: "",
    feeYear: String(new Date().getFullYear()),
    months: [] as number[],
  });
  const [fineForm, setFineForm] = useState({ fine: "", reason: "" });

  const effectiveSchoolId = isSuperAdmin ? (schoolId || form.schoolId) : (user?.schoolId || "");

  const statsQuery = useQuery({
    queryKey: ["fees-dashboard", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get("/fees/dashboard", {
        params: { schoolId: effectiveSchoolId || undefined },
      });
      return response.data.data as DashboardStats;
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ["fees-invoices", search, status, page, effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get("/fees/invoices", {
        params: { search, status: status || undefined, page, limit: 15, schoolId: effectiveSchoolId || undefined },
      });
      return response.data;
    },
  });

  const schoolsQuery = useQuery({
    queryKey: ["fees-schools-list"],
    queryFn: async () => {
      const response = await api.get("/schools", { params: { limit: 100 } });
      return response.data.data || [];
    },
    enabled: !!isSuperAdmin,
  });

  const classesQuery = useQuery({
    queryKey: ["fees-classes", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get(`/schools/${effectiveSchoolId}/classes`);
      return response.data.data || [];
    },
    enabled: !!effectiveSchoolId,
  });

  const studentsQuery = useQuery({
    queryKey: ["fees-students", effectiveSchoolId, form.classId, form.sectionId],
    queryFn: async () => {
      const response = await api.get("/students", {
        params: { classId: form.classId, sectionId: form.sectionId || undefined, limit: 300 },
      });
      return response.data.data || [];
    },
    enabled: !!(effectiveSchoolId && form.classId),
  });

  const sectionsQuery = useQuery({
    queryKey: ["fees-sections", effectiveSchoolId, form.classId],
    queryFn: async () => {
      const response = await api.get(
        `/schools/${effectiveSchoolId}/classes/${form.classId}/sections`
      );
      return response.data.data || [];
    },
    enabled: !!(effectiveSchoolId && form.classId),
  });

  const yearsQuery = useQuery({
    queryKey: ["fees-years", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get("/fees/academic-years", {
        params: { schoolId: effectiveSchoolId || undefined },
      });
      return response.data.data as YearRow[];
    },
    enabled: !!effectiveSchoolId || !isSuperAdmin,
  });

  const createInvoice = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/fees/invoices", payload);
    },
    onSuccess: () => {
      toast.success(t("fees.invoiceGenerated"));
      setShowInvoiceForm(false);
      setForm({ schoolId: "", classId: "", sectionId: "", studentId: "", amount: "", description: "", dueDate: "" });
      queryClient.invalidateQueries({ queryKey: ["fees-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["fees-dashboard"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const collectPayment = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/fees/payments", payload);
    },
    onSuccess: () => {
      toast.success(t("fees.paymentCollected"));
      setPayingFor(null);
      setPaymentForm({ amount: "", method: "CASH", transactionId: "" });
      queryClient.invalidateQueries({ queryKey: ["fees-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["fees-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["fees-invoice-detail"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const generateBulk = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post("/fees/generate-invoices", payload);
      return response.data.data as { count?: number; message?: string };
    },
    onSuccess: (data) => {
      toast.success(data?.message || t("fees.invoicesGenerated", { n: data?.count ?? 0 }));
      setShowBulk(false);
      setBulk({ academicYearId: "", feeYear: String(new Date().getFullYear()), months: [] });
      queryClient.invalidateQueries({ queryKey: ["fees-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["fees-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["fees-years"] });
      queryClient.invalidateQueries({ queryKey: ["fees-pending-report"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const applyFine = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post(`/fees/invoices/${payload.invoiceId}/fine`, payload);
      return response.data.data as { invoice?: Partial<InvoiceDetail> };
    },
    onSuccess: (data) => {
      toast.success(t("fees.fineAdjusted"));
      setFiningFor(null);
      setFineForm({ fine: "", reason: "" });
      if (data?.invoice?.id && detail?.id === data.invoice.id) {
        setDetail({
          ...detail,
          fine: Number(data.invoice.fine ?? detail.fine),
          totalAmount: Number(data.invoice.totalAmount ?? detail.totalAmount),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["fees-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["fees-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["fees-pending-report"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const sendReceipt = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      const response = await api.post(`/fees/invoices/${invoiceId}/send-receipt`, { channel: "EMAIL" });
      return response.data.data as { status?: string };
    },
    onSuccess: (data) => {
      toast.success(data?.status === "SENT" ? t("fees.receiptSent") : t("fees.receiptQueued"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stats = statsQuery.data;
  const invoices = invoicesQuery.data?.data || [];

  const outstandingFor = (inv: any) =>
    Number(inv.totalAmount) + (Number(inv.fine) || 0) - (Number(inv.discount) || 0) - (Number(inv.paidAmount) || 0);

  const toggleMonth = (m: number) =>
    setBulk((b) => ({
      ...b,
      months: b.months.includes(m) ? b.months.filter((x) => x !== m) : [...b.months, m],
    }));

  const loadDetail = async (invoiceId: string) => {
    if (detail?.id === invoiceId) {
      setDetail(null);
      setExpanded(null);
      return;
    }
    try {
      const response = await api.get(`/fees/invoices/${invoiceId}`, {
        params: { schoolId: effectiveSchoolId || undefined },
      });
      setDetail(response.data.data as InvoiceDetail);
      setExpanded(invoiceId);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const balance = useMemo(() => {
    const t = Number(form.amount || 0);
    const d = Number(paymentForm.amount || 0);
    return t - d;
  }, [form.amount, paymentForm.amount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("pages.fees")}</h1>
          <p className="text-sm text-slate-500">{t("fees.subtitle")}</p>
        </div>
        {view === "overview" && canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isSuperAdmin && !effectiveSchoolId}
              onClick={() => setShowBulk(!showBulk)}
            >
              <Sparkles className="ms-2 h-4 w-4" />
              {t("fees.bulkGenerate")}
            </Button>
            <Button
              onClick={() => {
                setShowInvoiceForm(!showInvoiceForm);
                if (!showInvoiceForm) setForm({ ...form, schoolId: schoolId });
              }}
            >
              <Plus className="ms-2 h-4 w-4" />
              {t("fees.generateInvoice")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["overview", t("common.overview")],
            ["years", t("settings.general.academicYears")],
            ["structures", t("fees.structures")],
            ["reports", t("fees.pendingReport")],
          ] as [FeeView, string][]
        ).map(([key, label]) => (
          <Button key={key} variant={view === key ? "default" : "outline"} size="sm" onClick={() => setView(key)}>
            {label}
          </Button>
        ))}
      </div>

      {view === "years" && (
        <AcademicYearsView effectiveSchoolId={effectiveSchoolId} isSuperAdmin={isSuperAdmin} canManage={canManage} />
      )}

      {view === "structures" && (
        <StructuresView effectiveSchoolId={effectiveSchoolId} isSuperAdmin={isSuperAdmin} canManage={canManage} />
      )}

      {view === "reports" && (
        <PendingReportView effectiveSchoolId={effectiveSchoolId} isSuperAdmin={isSuperAdmin} />
      )}

      {view === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={t("fees.collectedThisMonth")}
              value={fmt(stats?.currentMonthCollected ?? 0)}
              change={t(
                (stats?.totalInvoices || 0) === 1 ? "fees.totalInvoicesOne" : "fees.totalInvoicesMany",
                { n: stats?.totalInvoices || 0 }
              )}
              icon={<CheckCircle2 className="h-5 w-5" />}
              iconBg="bg-green-50 text-green-600"
            />
            <StatCard
              title={t("fees.pendingCollection")}
              value={fmt(stats?.totalPending || 0)}
              icon={<Wallet className="h-5 w-5" />}
              iconBg="bg-blue-50 text-blue-600"
            />
            <StatCard
              title={t("fees.overdue")}
              value={t(
                (stats?.overdueInvoices || 0) === 1 ? "fees.overdueInvoicesOne" : "fees.overdueInvoicesMany",
                { n: stats?.overdueInvoices || 0 }
              )}
              icon={<AlertCircle className="h-5 w-5" />}
              iconBg="bg-red-50 text-red-600"
            />
            <StatCard
              title={t("fees.collectionRate")}
              value={`${stats?.collectionRate || 0}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              iconBg="bg-purple-50 text-purple-600"
            />
          </div>

          {showBulk && (
            <Card className="border-primary-200 bg-primary-50/30">
              <CardHeader>
                <CardTitle className="text-base">
                  <Sparkles className="ms-1 inline h-4 w-4" />
                  {t("fees.bulkMonthlyInvoices")}
                </CardTitle>
                <CardDescription>{t("fees.bulkDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!bulk.academicYearId) {
                      toast.error(t("fees.chooseAcademicYear"));
                      return;
                    }
                    if (bulk.months.length === 0) {
                      toast.error(t("fees.selectFeeMonth"));
                      return;
                    }
                    generateBulk.mutate({
                      academicYearId: bulk.academicYearId,
                      feeMonths: bulk.months,
                      feeYear: Number(bulk.feeYear),
                      schoolId: effectiveSchoolId || undefined,
                    });
                  }}
                >
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      <CalendarDays className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                      {t("settings.general.academicYears")} *
                    </label>
                    <select
                      required
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                      value={bulk.academicYearId}
                      onChange={(e) => setBulk({ ...bulk, academicYearId: e.target.value })}
                    >
                      <option value="">{t("fees.selectAcademicYear")}</option>
                      {(yearsQuery.data || []).map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.name}
                          {year.isCurrent ? t("settings.general.current") : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.feeYear")} *</label>
                    <Input
                      required
                      type="number"
                      min={2020}
                      max={2100}
                      value={bulk.feeYear}
                      onChange={(e) => setBulk({ ...bulk, feeYear: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.feeMonths")} *</label>
                    <div className="grid grid-cols-3 gap-1 rounded-md border border-slate-200 bg-white p-2 sm:grid-cols-4">
                      {AY_MONTHS.map(([m]) => (
                        <label key={m} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300"
                            checked={bulk.months.includes(m)}
                            onChange={() => toggleMonth(m)}
                          />
                          {t(`fees.month.${m}`)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-4">
                    <Button type="button" variant="outline" onClick={() => setShowBulk(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={generateBulk.isPending || (isSuperAdmin && !effectiveSchoolId)}
                    >
                      {generateBulk.isPending ? (
                        <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="ms-2 h-4 w-4" />
                      )}
                      {generateBulk.isPending ? t("fees.generating") : t("fees.generateInvoices")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showInvoiceForm && (
            <Card className="border-primary-200 bg-primary-50/30">
              <CardHeader>
                <CardTitle className="text-base">
                  <Receipt className="ms-1 inline h-4 w-4" />
                  {t("fees.generateInvoice")}
                </CardTitle>
                <CardDescription>{t("fees.generateInvoiceDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const payload: any = {
                      studentId: form.studentId,
                      amount: Number(form.amount),
                    };
                    if (form.description) payload.description = form.description;
                    if (form.dueDate) payload.dueDate = new Date(`${form.dueDate}T00:00:00`).toISOString();
                    payload.schoolId = effectiveSchoolId;
                    createInvoice.mutate(payload);
                  }}
                >
                  {isSuperAdmin && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        <Building2 className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                        {t("fees.school")} *
                      </label>
                      <select
                        required
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                        value={form.schoolId}
                        onChange={(e) => {
                          setForm({ ...form, schoolId: e.target.value, classId: "", sectionId: "", studentId: "" });
                          setSchoolId(e.target.value);
                        }}
                      >
                        <option value="">{t("fees.selectSchool")}</option>
                        {(schoolsQuery.data || []).map((school: any) => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      <GraduationCap className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                      {t("fees.studentClass")} *
                    </label>
                    <select
                      required
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                      value={form.classId}
                      onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: "", studentId: "" })}
                      disabled={!effectiveSchoolId}
                    >
                      <option value="">
                        {!effectiveSchoolId ? t("fees.selectSchoolFirst") : t("fees.selectClass")}
                      </option>
                      {(classesQuery.data || []).map((cls: any) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      <Layers className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                      {t("fees.section")}
                    </label>
                    <select
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                      value={form.sectionId}
                      onChange={(e) => setForm({ ...form, sectionId: e.target.value, studentId: "" })}
                      disabled={!form.classId}
                    >
                      <option value="">
                        {!form.classId ? t("fees.selectClassFirst") : t("fees.allSections")}
                      </option>
                      {(sectionsQuery.data || []).map((sec: any) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      <Wallet className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                      {t("fees.student")} *
                    </label>
                    <select
                      required
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                      value={form.studentId}
                      onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                      disabled={!form.classId}
                    >
                      <option value="">
                        {!form.classId ? t("fees.selectClassFirst") : t("fees.selectStudent")}
                      </option>
                      {(studentsQuery.data || []).map((student: any) => (
                        <option key={student.id} value={student.id}>
                          {student.firstName} {student.lastName} ({student.admissionNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      <Banknote className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                      {t("fees.amountCurrency")} *
                    </label>
                    <Input
                      required
                      type="number"
                      min={1}
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder={t("fees.amountPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.description")}</label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder={t("fees.descriptionPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.dueDate")}</label>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Button type="submit" disabled={createInvoice.isPending}>
                      {createInvoice.isPending ? (
                        <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Receipt className="ms-2 h-4 w-4" />
                      )}
                      {createInvoice.isPending ? t("fees.generating") : t("fees.generateInvoice")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {isSuperAdmin && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <label className="text-sm font-medium text-slate-700">{t("fees.schoolFilter")}:</label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:max-w-xs"
                    value={schoolId}
                    onChange={(e) => {
                      setSchoolId(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">{t("fees.allSchools")}</option>
                    {(schoolsQuery.data || []).map((school: any) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-base">{t("fees.invoices")}</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="w-full ps-9 sm:w-64"
                      placeholder={t("fees.searchPlaceholder")}
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(["", "PENDING", "PARTIAL", "OVERDUE", "PAID"] as const).map((s) => (
                      <Button
                        key={s}
                        variant={status === s ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setStatus(s);
                          setPage(1);
                        }}
                      >
                        {s === "" ? t("common.all") : t(`fees.status.${s}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {invoicesQuery.isLoading ? (
                <LoadingState />
              ) : invoicesQuery.isError ? (
                <ErrorState message={t("fees.loadInvoicesFailed")} onRetry={() => invoicesQuery.refetch()} />
              ) : invoices.length === 0 ? (
                <EmptyState
                  title={t("fees.noInvoices")}
                  description={
                    search || status
                      ? t("fees.noInvoicesFiltered")
                      : t("fees.noInvoicesHint")
                  }
                />
              ) : (
                <div className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("fees.invoice")}</TableHead>
                        <TableHead>{t("fees.student")}</TableHead>
                        <TableHead>{t("common.amount")}</TableHead>
                        <TableHead>{t("fees.paid")}</TableHead>
                        <TableHead>{t("fees.balance")}</TableHead>
                        <TableHead>{t("fees.due")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                        <TableHead className="text-end">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv: Invoice) => {
                        const oustanding = outstandingFor(inv);
                        return (
                          <Fragment key={inv.id}>
                            <TableRow key={inv.id} className="cursor-pointer" onClick={() => loadDetail(inv.id)}>
                              <TableCell className="font-mono text-xs font-medium">
                                {inv.invoiceNumber}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>
                                    {inv.student?.firstName} {inv.student?.lastName}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {inv.student?.admissionNumber}
                                    {inv.student?.class ? ` · ${inv.student.class.name}` : ""}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-600">{fmt(Number(inv.totalAmount))}</TableCell>
                              <TableCell className="text-slate-600">{fmt(Number(inv.paidAmount))}</TableCell>
                              <TableCell className="font-medium">{fmt(Math.max(0, oustanding))}</TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {inv.dueDate
                                  ? new Date(inv.dueDate).toLocaleDateString()
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant[inv.status] || "secondary"}>
                                  {t(`fees.status.${inv.status}`)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => loadDetail(inv.id)}>
                                    {expanded === inv.id ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                  {oustanding > 0 && canManage ? (
                                    <Button size="sm" onClick={() => setPayingFor(inv)}>
                                      {t("fees.collect")}
                                    </Button>
                                  ) : (
                                    <Button variant="outline" size="sm" onClick={() => loadDetail(inv.id)}>
                                      <FileText className="me-1 h-3.5 w-3.5" />
                                      {t("common.view")}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {expanded === inv.id && detail?.id === inv.id && (
                              <TableRow key={`${inv.id}-detail`}>
                                <TableCell colSpan={8}>
                                  <div className="grid gap-4 p-2 sm:grid-cols-2">
                                    <div>
                                      <h4 className="mb-2 text-sm font-semibold text-slate-700">{t("fees.invoiceItems")}</h4>
                                      <div className="space-y-1">
                                        {detail.items.map((item) => (
                                          <div key={item.id} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600">{item.description}</span>
                                            <span className="font-medium">{fmt(Number(item.amount))}</span>
                                          </div>
                                        ))}
                                        {Number(detail.discount) > 0 && (
                                          <div className="flex items-center justify-between text-sm text-green-600">
                                            <span>{t("fees.discount")}</span>
                                            <span>-{fmt(Number(detail.discount))}</span>
                                          </div>
                                        )}
                                        {Number(detail.fine) > 0 && (
                                          <div className="flex items-center justify-between text-sm text-red-600">
                                            <span>{t("fees.fine")}</span>
                                            <span>+{fmt(Number(detail.fine))}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-semibold">
                                          <span>{t("common.total")}</span>
                                          <span>{fmt(Number(detail.totalAmount) + Number(detail.fine) - Number(detail.discount))}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="mb-2 text-sm font-semibold text-slate-700">
                                        {t("fees.paymentHistory")}
                                      </h4>
                                      {detail.payments.length === 0 ? (
                                        <p className="text-sm text-slate-400">{t("fees.noPayments")}</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {detail.payments.map((payment) => (
                                            <div
                                              key={payment.id}
                                              className="flex items-center justify-between rounded-md border border-slate-100 p-2 text-sm"
                                            >
                                              <div>
                                                <span className="font-medium">{fmt(Number(payment.amount))}</span>
                                                <span className="ms-1 text-xs text-slate-400">{payment.method}</span>
                                                {payment.transactionId && (
                                                  <div className="text-xs text-slate-400">
                                                    {t("fees.tx", { tx: payment.transactionId })}
                                                  </div>
                                                )}
                                              </div>
                                              <span className="text-xs text-slate-400">
                                                {new Date(payment.paidAt).toLocaleString()}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        downloadPdf(
                                          `/fees/invoices/${detail.id}/pdf?schoolId=${effectiveSchoolId || ""}`,
                                          `${detail.invoiceNumber}.pdf`
                                        ).catch((error) => toast.error(getErrorMessage(error)))
                                      }
                                    >
                                      <Download className="me-1 h-3.5 w-3.5" />
                                      PDF
                                    </Button>
                                    {canManage && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={sendReceipt.isPending}
                                        onClick={() => sendReceipt.mutate({ invoiceId: detail.id })}
                                      >
                                        <Send className="me-1 h-3.5 w-3.5" />
                                        {t("fees.sendReceipt")}
                                      </Button>
                                    )}
                                    {canManage && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setFiningFor(finingFor === detail.id ? null : detail.id);
                                          setFineForm({ fine: "", reason: "" });
                                        }}
                                      >
                                        <Scale className="me-1 h-3.5 w-3.5" />
                                        {t("fees.fine")}
                                      </Button>
                                    )}
                                  </div>
                                  {finingFor === detail.id && (
                                    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
                                      <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">
                                          {t("fees.fineAmountLabel")} *
                                        </label>
                                        <Input
                                          type="number"
                                          min={1}
                                          step="0.01"
                                          className="w-36"
                                          value={fineForm.fine}
                                          onChange={(e) => setFineForm({ ...fineForm, fine: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">
                                          {t("fees.reason")}
                                        </label>
                                        <Input
                                          className="w-64"
                                          value={fineForm.reason}
                                          onChange={(e) => setFineForm({ ...fineForm, reason: e.target.value })}
                                          placeholder={t("fees.fineReasonPlaceholder")}
                                        />
                                      </div>
                                      <Button
                                        size="sm"
                                        disabled={applyFine.isPending}
                                        onClick={() => {
                                          const fine = Number(fineForm.fine);
                                          if (!fine || fine <= 0) {
                                            toast.error(t("fees.enterFineAmount"));
                                            return;
                                          }
                                          applyFine.mutate({
                                            invoiceId: detail.id,
                                            fine,
                                            reason: fineForm.reason || undefined,
                                            schoolId: effectiveSchoolId || undefined,
                                          });
                                        }}
                                      >
                                        {applyFine.isPending ? (
                                          <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="me-1 h-3.5 w-3.5" />
                                        )}
                                        {t("fees.apply")}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFiningFor(null)}
                                      >
                                        {t("common.cancel")}
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {(invoicesQuery.data?.meta?.totalPages || 1) > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <p className="text-sm text-slate-500">
                        {t("common.pageOf", { page, total: invoicesQuery.data?.meta?.totalPages })}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                          {t("common.previous")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= (invoicesQuery.data?.meta?.totalPages || 1)}
                          onClick={() => setPage(page + 1)}
                        >
                          {t("common.next")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {payingFor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="text-base">
                    <Banknote className="ms-1 inline h-4 w-4" />
                    {t("fees.collectPayment")}
                  </CardTitle>
                  <CardDescription>
                    {payingFor.invoiceNumber} · {payingFor.student?.firstName} {payingFor.student?.lastName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{t("common.total")}</p>
                        <p className="text-base font-semibold">{fmt(Number(payingFor.totalAmount) + Number(payingFor.fine) - Number(payingFor.discount))}</p>
                      </div>
                      <div className="rounded-md bg-green-50 p-3">
                        <p className="text-xs text-slate-500">{t("fees.alreadyPaid")}</p>
                        <p className="text-base font-semibold text-green-700">{fmt(Number(payingFor.paidAmount))}</p>
                      </div>
                    </div>

                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        collectPayment.mutate({
                          invoiceId: payingFor.id,
                          amount: Number(paymentForm.amount),
                          method: paymentForm.method,
                          transactionId: paymentForm.transactionId || undefined,
                          schoolId: effectiveSchoolId,
                        });
                      }}
                    >
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          {t("fees.amountCurrency")} *
                        </label>
                        <Input
                          required
                          type="number"
                          min={0.01}
                          max={outstandingFor(payingFor)}
                          step="0.01"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          placeholder={t("fees.outstandingPlaceholder", { amount: fmt(outstandingFor(payingFor)) })}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          {t("fees.paymentMethod")} *
                        </label>
                        <select
                          required
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                          value={paymentForm.method}
                          onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                        >
                          {paymentMethods.map((method) => (
                            <option key={method} value={method}>
                              {method.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          {t("fees.transactionIdLabel")}
                        </label>
                        <Input
                          value={paymentForm.transactionId}
                          onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                          placeholder={t("fees.transactionPlaceholder")}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-600">
                          {t("fees.balanceAfterPayment")}
                        </span>
                        <span className="font-semibold">
                          {fmt(Math.max(0, balance))}
                        </span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPayingFor(null);
                            setPaymentForm({ amount: "", method: "CASH", transactionId: "" });
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button type="submit" disabled={collectPayment.isPending}>
                          {collectPayment.isPending ? (
                            <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="ms-2 h-4 w-4" />
                          )}
                          {collectPayment.isPending ? t("fees.collecting") : t("fees.collectPayment")}
                        </Button>
                      </div>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}