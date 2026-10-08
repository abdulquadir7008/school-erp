"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { downloadPdf, fmt, statusVariant } from "@/components/fees/shared";
import type { InvoiceStatus } from "@/components/fees/shared";
import { useI18n } from "@/components/language-provider";

interface AcademicYearRow {
  id: string;
  name: string;
  isCurrent?: boolean;
}

interface PendingSummary {
  totalStudents: number;
  totalRecords: number;
  statusCounts: { PAID: number; PARTIAL: number; PENDING: number; OVERDUE: number };
  totalFee: number;
  totalPaid: number;
  totalFine: number;
  totalDiscount: number;
  totalPending: number;
}

interface ClassSummaryRow {
  className: string;
  sectionName: string;
  totalStudents: number;
  paidStudents: number;
  partialStudents: number;
  pendingStudents: number;
  totalFee: number;
  totalPaid: number;
  totalPending: number;
}

interface PendingRow {
  id: string;
  invoiceNumber: string;
  studentName: string;
  admissionNumber: string;
  rollNumber?: number | null;
  className: string;
  sectionName: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  feeMonthLabel: string;
  feeType: string | null;
  totalFee: number;
  paidAmount: number;
  fine: number;
  discount: number;
  pending: number;
  dueDate?: string | null;
  status: InvoiceStatus;
}

interface PendingReport {
  rows: PendingRow[];
  summary: PendingSummary;
  classSummary: ClassSummaryRow[];
}

const statusFilters = ["", "PENDING", "PARTIAL", "OVERDUE", "PAID"] as const;

export function PendingReportView({
  effectiveSchoolId,
  isSuperAdmin,
}: {
  effectiveSchoolId: string;
  isSuperAdmin: boolean;
}) {
  const [academicYearId, setAcademicYearId] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const { t } = useI18n();

  const yearsQuery = useQuery({
    queryKey: ["fees-years", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get("/fees/academic-years", {
        params: { schoolId: effectiveSchoolId || undefined },
      });
      return response.data.data as AcademicYearRow[];
    },
    enabled: !!effectiveSchoolId || !isSuperAdmin,
  });

  const reportQuery = useQuery({
    queryKey: ["fees-pending-report", effectiveSchoolId, academicYearId, status],
    queryFn: async () => {
      const response = await api.get("/fees/reports/pending", {
        params: {
          academicYearId: academicYearId || undefined,
          status: status || undefined,
          schoolId: effectiveSchoolId || undefined,
        },
      });
      return response.data.data as PendingReport;
    },
    enabled: !!effectiveSchoolId || !isSuperAdmin,
  });

  const exportPdf = async () => {
    try {
      await downloadPdf(
        `/fees/reports/pending-pdf?academicYearId=${academicYearId || ""}&schoolId=${effectiveSchoolId || ""}`,
        `pending-fees-report.pdf`
      );
      toast.success(t("fees.reportDownloaded"));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const summary = reportQuery.data?.summary;
  const rows = reportQuery.data?.rows || [];
  const classSummary = reportQuery.data?.classSummary || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">{t("fees.pendingFeeReport")}</CardTitle>
              <CardDescription>{t("fees.pendingReportDesc")}</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:w-56"
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
              >
                <option value="">{t("fees.allAcademicYears")}</option>
                {(yearsQuery.data || []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                    {year.isCurrent ? t("settings.general.current") : ""}
                  </option>
                ))}
              </select>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as "" | InvoiceStatus)}
              >
                {statusFilters.map((s) => (
                  <option key={s || "ALL"} value={s}>
                    {s === "" ? t("fees.allStatuses") : t(`fees.status.${s}`)}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={exportPdf} disabled={rows.length === 0}>
                <Download className="ms-2 h-4 w-4" />
                {t("fees.exportPdf")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reportQuery.isLoading ? (
            <LoadingState label={t("fees.buildingReport")} />
          ) : reportQuery.isError ? (
            <ErrorState message={t("fees.loadReportFailed")} onRetry={() => reportQuery.refetch()} />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title={t("fees.totalPending")}
                  value={fmt(summary?.totalPending ?? 0)}
                  icon={<Filter className="h-5 w-5" />}
                  iconBg="bg-blue-50 text-blue-600"
                />
                <StatCard
                  title={t("fees.studentsOwing")}
                  value={String(summary?.totalStudents ?? 0)}
                  icon={<Users2 className="h-5 w-5" />}
                  iconBg="bg-purple-50 text-purple-600"
                />
                <StatCard
                  title={t("fees.invoicesInScope")}
                  value={String(summary?.totalRecords ?? 0)}
                  icon={<Users2 className="h-5 w-5" />}
                  iconBg="bg-slate-100 text-slate-600"
                />
                <StatCard
                  title={t("fees.finesCollected")}
                  value={fmt(summary?.totalFine ?? 0)}
                  icon={<Filter className="h-5 w-5" />}
                  iconBg="bg-red-50 text-red-600"
                />
              </div>

              <p className="text-sm text-slate-500">
                {t("fees.collected")} <span className="font-medium text-slate-700">{fmt(summary?.totalPaid ?? 0)}</span>
                <span className="mx-2">·</span>
                {t("fees.expected")} <span className="font-medium text-slate-700">{fmt(summary?.totalFee ?? 0)}</span>
                <span className="mx-2">·</span>
                {t("fees.discounts")}{" "}
                <span className="font-medium text-slate-700">{fmt(summary?.totalDiscount ?? 0)}</span>
              </p>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{t("fees.classWiseSummary")}</h3>
                {classSummary.length === 0 ? (
                  <EmptyState title={t("common.noData")} description={t("fees.noInvoicesFiltered")} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("fees.classSection")}</TableHead>
                        <TableHead>{t("fees.students")}</TableHead>
                        <TableHead>{t("fees.paid")}</TableHead>
                        <TableHead>{t("fees.partial")}</TableHead>
                        <TableHead>{t("fees.pending")}</TableHead>
                        <TableHead className="text-end">{t("fees.expected")}</TableHead>
                        <TableHead className="text-end">{t("fees.collected")}</TableHead>
                        <TableHead className="text-end">{t("fees.pending")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classSummary.map((c) => (
                        <TableRow key={`${c.className}${c.sectionName}`}>
                          <TableCell className="font-medium">
                            {c.className}
                            {c.sectionName && c.sectionName !== "—" ? ` · ${c.sectionName}` : ""}
                          </TableCell>
                          <TableCell>{c.totalStudents}</TableCell>
                          <TableCell>{c.paidStudents}</TableCell>
                          <TableCell>{c.partialStudents}</TableCell>
                          <TableCell>{c.pendingStudents}</TableCell>
                          <TableCell className="text-right">{fmt(c.totalFee)}</TableCell>
                          <TableCell className="text-right">{fmt(c.totalPaid)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(c.totalPending)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{t("common.details")}</h3>
                {rows.length === 0 ? (
                  <EmptyState title={t("fees.noPendingBalances")} description={t("fees.nothingOutstanding")} />
                ) : (
                  <div className="overflow-x-auto rounded-md border border-slate-100">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("fees.student")}</TableHead>
                          <TableHead>{t("fees.invoice")}</TableHead>
                          <TableHead>{t("fees.period")}</TableHead>
                          <TableHead>{t("common.total")}</TableHead>
                          <TableHead>{t("fees.paid")}</TableHead>
                          <TableHead>{t("fees.fine")}</TableHead>
                          <TableHead className="text-end">{t("fees.pending")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{r.studentName}</span>
                                <span className="text-xs text-slate-400">
                                  {r.admissionNumber}
                                  {r.className && r.className !== "—" ? ` · ${r.className}` : ""}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.invoiceNumber}</TableCell>
                            <TableCell className="text-sm text-slate-500">{r.feeMonthLabel}</TableCell>
                            <TableCell>{fmt(r.totalFee)}</TableCell>
                            <TableCell>{fmt(r.paidAmount)}</TableCell>
                            <TableCell className={r.fine > 0 ? "text-red-600" : "text-slate-400"}>
                              {fmt(r.fine)}
                            </TableCell>
                            <TableCell className="text-right font-medium">{fmt(r.pending)}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant[r.status] || "secondary"}>{t(`fees.status.${r.status}`)}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}