"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers3, Loader2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
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
import { fmt } from "@/components/fees/shared";
import { useI18n } from "@/components/language-provider";

interface Category {
  id: string;
  name: string;
  description?: string | null;
  _count?: { structures?: number };
}

interface SchoolClass {
  id: string;
  name: string;
}

interface AcademicYearRow {
  id: string;
  name: string;
  isCurrent?: boolean;
}

interface FeeStructure {
  id: string;
  name: string;
  feeType: string;
  amount: number;
  recurringType?: string | null;
  feeCategory?: { id: string; name: string } | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
  student?: { id: string; firstName: string; lastName: string; admissionNumber: string } | null;
  academicYear?: { id: string; name: string } | null;
  _count?: { invoices?: number };
}

const feeTypes = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"] as const;

export function StructuresView({
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    feeType: "MONTHLY",
    amount: "",
    recurringType: "MONTHLY",
    feeCategoryId: "",
    academicYearId: "",
    classId: "",
  });

  const ready = !!effectiveSchoolId || !isSuperAdmin;

  const structuresQuery = useQuery({
    queryKey: ["fees-structures", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get("/fees/structures", {
        params: { schoolId: effectiveSchoolId || undefined },
      });
      return response.data as {
        data: FeeStructure[];
        categories: Category[];
      };
    },
    enabled: ready,
  });

  const classesQuery = useQuery({
    queryKey: ["fees-classes", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get(`/schools/${effectiveSchoolId}/classes`);
      return response.data.data as SchoolClass[];
    },
    enabled: !!effectiveSchoolId,
  });

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

  const resetForm = () =>
    setForm({
      name: "",
      feeType: "MONTHLY",
      amount: "",
      recurringType: "MONTHLY",
      feeCategoryId: "",
      academicYearId: "",
      classId: "",
    });

  const startCreate = () => {
    setEditingId(null);
    const cat = structuresQuery.data?.categories?.[0];
    resetForm();
    if (cat) setForm((f) => ({ ...f, feeCategoryId: cat.id }));
    setShowForm(true);
  };

  const startEdit = (s: FeeStructure) => {
    setEditingId(s.id);
    setShowForm(true);
    setForm({
      name: s.name,
      feeType: s.feeType || "MONTHLY",
      amount: String(s.amount),
      recurringType: s.recurringType || "MONTHLY",
      feeCategoryId: s.feeCategory?.id || "",
      academicYearId: s.academicYear?.id || "",
      classId: s.class?.id || "",
    });
  };

  const saveStructure = useMutation({
    mutationFn: async (payload: any) => {
      const response = editingId
        ? await api.put(`/fees/structures/${editingId}`, payload)
        : await api.post("/fees/structures", payload);
      return response.data.data as FeeStructure;
    },
    onSuccess: () => {
      toast.success(editingId ? t("fees.structureUpdated") : t("fees.structureCreated"));
      setShowForm(false);
      setEditingId(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["fees-structures"] });
      queryClient.invalidateQueries({ queryKey: ["fees-dashboard"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteStructure = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fees/structures/${id}`);
    },
    onSuccess: () => {
      toast.success(t("fees.structureDeleted"));
      queryClient.invalidateQueries({ queryKey: ["fees-structures"] });
      queryClient.invalidateQueries({ queryKey: ["fees-dashboard"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const structures = structuresQuery.data?.data || [];
  const categories = structuresQuery.data?.categories || [];

  return (
    <div className="space-y-4">
      {isSuperAdmin && !effectiveSchoolId && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-800">{t("fees.structuresSelectSchool")}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-sm font-semibold text-slate-800">{cat.name}</p>
                <p className="text-xs text-slate-500">{cat.description || t("fees.feeCategory")}</p>
              </div>
              <Badge variant="secondary">
                <Layers3 className="me-1 h-3 w-3" />
                {t(
                  cat._count?.structures === 1 ? "fees.structuresCountOne" : "fees.structuresCountMany",
                  { n: cat._count?.structures ?? 0 }
                )}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("fees.feeStructures")}</CardTitle>
              <CardDescription>{t("fees.feeStructuresDesc")}</CardDescription>
            </div>
            {canManage && ready && (
              <Button size="sm" onClick={startCreate}>
                <Plus className="ms-2 h-4 w-4" />
                {t("fees.addStructure")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              className="mb-6 grid grid-cols-1 gap-4 rounded-md border border-primary-200 bg-primary-50/30 p-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.feeCategoryId) {
                  toast.error(t("fees.chooseFeeCategory"));
                  return;
                }
                const payload: any = {
                  name: form.name,
                  amount: Number(form.amount),
                  feeType: form.feeType,
                  recurringType: form.recurringType,
                  feeCategoryId: form.feeCategoryId,
                  schoolId: effectiveSchoolId,
                };
                if (form.academicYearId) payload.academicYearId = form.academicYearId;
                if (form.classId) payload.classId = form.classId;
                saveStructure.mutate(payload);
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.name")} *</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("fees.structureNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.feeType")} *</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.feeType}
                  onChange={(e) =>
                    setForm({ ...form, feeType: e.target.value, recurringType: e.target.value })
                  }
                >
                  {feeTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(`fees.feeTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.amountCurrency")} *</label>
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
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.category")} *</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.feeCategoryId}
                  onChange={(e) => setForm({ ...form, feeCategoryId: e.target.value })}
                >
                  <option value="">{t("fees.selectCategory")}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("settings.general.academicYears")}</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.academicYearId}
                  onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
                >
                  <option value="">{t("fees.allYears")}</option>
                  {(yearsQuery.data || []).map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.isCurrent ? t("settings.general.current") : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("fees.classLabel")}</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                >
                  <option value="">{t("fees.allClasses")}</option>
                  {(classesQuery.data || []).map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2 lg:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={saveStructure.isPending}>
                  {saveStructure.isPending ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="ms-2 h-4 w-4" />
                  )}
                  {editingId ? t("settings.profile.saveChanges") : t("fees.createStructure")}
                </Button>
              </div>
            </form>
          )}

          {structuresQuery.isLoading ? (
            <LoadingState />
          ) : structuresQuery.isError ? (
            <ErrorState message={t("fees.loadStructuresFailed")} onRetry={() => structuresQuery.refetch()} />
          ) : structures.length === 0 ? (
            <EmptyState
              title={t("fees.noStructures")}
              description={t("fees.noStructuresHint")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("fees.appliesTo")}</TableHead>
                  <TableHead>{t("settings.general.academicYears")}</TableHead>
                  <TableHead>{t("fees.invoices")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structures.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.name}
                      <div className="text-xs text-slate-400">{s.feeCategory?.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(`fees.feeTypes.${s.feeType}`)}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{fmt(s.amount)}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {s.class?.name || s.section?.name || s.student?.firstName
                        ? s.student
                          ? `${s.student.firstName} ${s.student.lastName}`
                          : s.section?.name || s.class?.name || "—"
                        : t("fees.allStudents")}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {s.academicYear?.name || "—"}
                    </TableCell>
                    <TableCell>{s._count?.invoices ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(s)}
                            title={t("common.edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            title={t("common.delete")}
                            onClick={() => {
                              if (window.confirm(t("fees.deleteConfirm", { name: s.name }))) {
                                deleteStructure.mutate(s.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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