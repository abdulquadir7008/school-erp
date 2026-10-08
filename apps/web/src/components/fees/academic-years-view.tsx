"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Check, Loader2, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useI18n } from "@/components/language-provider";

interface AcademicYearRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  status?: string | null;
  _count?: { classes?: number; invoices?: number };
}

const fmtDate = (d: string) => new Date(`${d}`).toLocaleDateString();

export function AcademicYearsView({
  effectiveSchoolId,
  isSuperAdmin,
  canManage,
}: {
  effectiveSchoolId: string;
  isSuperAdmin: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
  });

  const ready = !!effectiveSchoolId || !isSuperAdmin;

  const yearsQuery = useQuery({
    queryKey: ["fees-years", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get("/fees/academic-years", {
        params: { schoolId: effectiveSchoolId || undefined },
      });
      return response.data.data as AcademicYearRow[];
    },
    enabled: ready,
  });

  const createYear = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post("/fees/academic-years", payload);
      return response.data.data as AcademicYearRow;
    },
    onSuccess: (data) => {
      toast.success(t("fees.yearCreated", { name: data.name }));
      setShowForm(false);
      setForm({ name: "", startDate: "", endDate: "", isCurrent: false });
      queryClient.invalidateQueries({ queryKey: ["fees-years"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const setCurrent = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/fees/academic-years/${id}/current`);
      return response.data.data as AcademicYearRow;
    },
    onSuccess: (data) => {
      toast.success(t("fees.yearSetCurrent", { name: data.name }));
      queryClient.invalidateQueries({ queryKey: ["fees-years"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const years = yearsQuery.data || [];

  return (
    <div className="space-y-4">
      {isSuperAdmin && !effectiveSchoolId && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-800">{t("fees.academicYearsSelectSchool")}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("settings.general.academicYears")}</CardTitle>
              <CardDescription>{t("fees.academicYearsDesc")}</CardDescription>
            </div>
            {canManage && ready && (
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? <Check className="ms-2 h-4 w-4" /> : <Plus className="ms-2 h-4 w-4" />}
                {showForm ? t("fees.closeForm") : t("fees.addYear")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              className="mb-6 grid grid-cols-1 gap-4 rounded-md border border-primary-200 bg-primary-50/30 p-4 sm:grid-cols-2 lg:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault();
                createYear.mutate({
                  name: form.name || undefined,
                  startDate: new Date(`${form.startDate}T00:00:00`).toISOString(),
                  endDate: new Date(`${form.endDate}T00:00:00`).toISOString(),
                  isCurrent: form.isCurrent,
                  schoolId: effectiveSchoolId,
                });
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.name")}</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("fees.academicYearNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.startDate")} *</label>
                <Input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.endDate")} *</label>
                <Input
                  required
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={form.isCurrent}
                  onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
                />
                {t("fees.setAsCurrent")}
              </label>
              <div className="flex items-end">
                <Button type="submit" disabled={createYear.isPending} className="w-full">
                  {createYear.isPending ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="ms-2 h-4 w-4" />
                  )}
                  {t("common.create")}
                </Button>
              </div>
              <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-5">
                {t("fees.academicYearsNote")}
              </p>
            </form>
          )}

          {yearsQuery.isLoading ? (
            <LoadingState />
          ) : yearsQuery.isError ? (
            <ErrorState message={t("fees.loadYearsFailed")} onRetry={() => yearsQuery.refetch()} />
          ) : years.length === 0 ? (
            <EmptyState
              title={t("settings.general.noAcademicYears")}
              description={t("fees.academicYearsAddHint")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("fees.period")}</TableHead>
                  <TableHead>{t("fees.classes")}</TableHead>
                  <TableHead>{t("fees.invoices")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.name}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {fmtDate(year.startDate)} – {fmtDate(year.endDate)}
                    </TableCell>
                    <TableCell>{year._count?.classes ?? 0}</TableCell>
                    <TableCell>{year._count?.invoices ?? 0}</TableCell>
                    <TableCell>
                      {year.isCurrent ? (
                        <Badge variant="success">{t("common.current")}</Badge>
                      ) : (
                        <Badge variant="secondary">{year.status || t("common.inactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && !year.isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={setCurrent.isPending}
                          onClick={() => setCurrent.mutate(year.id)}
                        >
                          <Star className="me-1 h-3.5 w-3.5" />
                          {t("fees.setCurrent")}
                        </Button>
                      )}
                      {year.isCurrent && (
                        <span className="inline-flex items-center text-xs text-slate-400">
                          <CalendarDays className="me-1 h-3.5 w-3.5" /> {t("fees.activeYear")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}