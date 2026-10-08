"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, BookOpen, Clock, Users, Plus, Loader2, Building2, GraduationCap, Pencil, Trash2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ClassesManager } from "@/components/academics/classes-manager";

interface Subject {
  id: string;
  name: string;
  code: string;
  schoolId: string;
  createdAt: string;
  _count?: { timetableEntries: number; assignments: number };
}

const emptyForm = { name: "", code: "", schoolId: "" };

export default function AcademicsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState<"subjects" | "classes">("subjects");
  const [classSchoolId, setClassSchoolId] = useState("");
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";

  const effectiveSchoolId = isSuperAdmin ? form.schoolId : user?.schoolId || "";

  const resetForm = () => setForm(emptyForm);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["subjects", search, page, isSuperAdmin],
    queryFn: async () => {
      const response = await api.get("/subjects", {
        params: { search, page, limit: 15 },
      });
      return response.data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ["subjects-stats"],
    queryFn: async () => {
      const response = await api.get("/subjects/dashboard");
      return response.data.data;
    },
  });

  const schoolsQuery = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => {
      const response = await api.get("/schools", { params: { limit: 100 } });
      return response.data.data || [];
    },
    enabled: !!isSuperAdmin,
  });

  const schoolNameMap: Record<string, string> = {};
  (schoolsQuery.data || []).forEach((school: any) => {
    schoolNameMap[school.id] = school.name;
  });

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      await api.post("/subjects", formData);
    },
    onSuccess: () => {
      toast.success(t("academics.subjectAdded"));
      setShowForm(false);
      setEditingSubject(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      await api.put(`/subjects/${id}`, formData);
    },
    onSuccess: () => {
      toast.success(t("academics.subjectUpdated"));
      setShowForm(false);
      setEditingSubject(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/subjects/${id}`);
    },
    onSuccess: () => {
      toast.success(t("academics.subjectDeleted"));
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stats = statsQuery.data || {};
  const subjects = data?.data || [];

  const startEdit = (subject: Subject) => {
    setShowForm(true);
    setEditingSubject(subject);
    setForm({
      name: subject.name,
      code: subject.code,
      schoolId: subject.schoolId || user?.schoolId || "",
    });
  };

  const confirmDelete = (subject: Subject) => {
    if (
      window.confirm(
        `${t("academics.deleteConfirm", { name: subject.name, code: subject.code })}\n${t("academics.deleteConfirmHint")}`
      )
    ) {
      deleteMutation.mutate(subject.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.academics")}</h1>
          <p className="text-sm text-slate-500">{t("academics.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditingSubject(null);
              if (!showForm) resetForm();
            }}
          >
            <Plus className="ms-2 h-4 w-4" />
            {editingSubject ? t("academics.newSubject") : t("academics.addSubject")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("academics.statSubjects")} value={String(stats.subjects || 0)} icon={<Clock className="h-5 w-5" />} iconBg="bg-purple-50 text-purple-600" />
        <StatCard title={t("academics.statClasses")} value={String(stats.classes || 0)} icon={<BookOpen className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
        <StatCard title={t("academics.statSections")} value={String(stats.sections || 0)} icon={<Users className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
        <StatCard title={t("academics.statAcademicYear")} value="2025-26" icon={<CalendarDays className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(["subjects", "classes"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {key === "subjects" ? t("academics.tabSubjects") : t("academics.tabClasses")}
          </button>
        ))}
      </div>

      {tab === "classes" ? (
        <>
          {isSuperAdmin && (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <label className="text-sm font-medium text-slate-700">
                  <Building2 className="ms-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("academics.school")} *
                </label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:max-w-xs"
                  value={classSchoolId}
                  onChange={(e) => setClassSchoolId(e.target.value)}
                >
                  <option value="">{t("academics.selectSchool")}</option>
                  {(schoolsQuery.data || []).map((school: any) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>
          )}
          {(isSuperAdmin ? classSchoolId : user?.schoolId) ? (
            <ClassesManager schoolId={isSuperAdmin ? classSchoolId : user?.schoolId || ""} />
          ) : (
            <EmptyState
              title={t("academics.noClasses")}
              description={t("academics.selectSchoolFirst")}
            />
          )}
        </>
      ) : (
        <>
      {showForm && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="text-base">
              <GraduationCap className="ms-1 inline h-4 w-4" />
              {editingSubject
                ? t("academics.editSubjectTitle", { name: editingSubject.name })
                : t("academics.addSubject")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (editingSubject) {
                  updateMutation.mutate({
                    id: editingSubject.id,
                    formData: { name: form.name, code: form.code },
                  });
                  return;
                }
                createMutation.mutate({
                  name: form.name,
                  code: form.code,
                  schoolId: effectiveSchoolId,
                });
              }}
            >
              {isSuperAdmin && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    <Building2 className="ms-1 inline h-3.5 w-3.5 text-slate-400" />
                    {t("academics.school")} *
                  </label>
                  <select
                    required
                    disabled={!!editingSubject}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    value={form.schoolId}
                    onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                  >
                    <option value="">{t("academics.selectSchool")}</option>
                    {(schoolsQuery.data || []).map((school: any) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("academics.subjectNameLabel")} *</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("academics.subjectNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("academics.subjectCodeLabel")} *</label>
                <Input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder={t("academics.subjectCodePlaceholder")}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {createMutation.isPending || updateMutation.isPending
                    ? t("common.saving")
                    : editingSubject
                      ? t("academics.saveChanges")
                      : t("academics.addSubject")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("academics.statSubjects")}</CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="w-64 ps-9"
                placeholder={t("academics.searchSubjects")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState message={t("academics.loadFailed")} onRetry={() => refetch()} />
          ) : subjects.length === 0 ? (
            <EmptyState
              title={t("academics.noSubjects")}
              description={search ? t("academics.noSubjectsMatch") : t("academics.addFirstSubject")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("academics.columnSubject")}</TableHead>
                  <TableHead>{t("common.code")}</TableHead>
                  {isSuperAdmin && <TableHead>{t("academics.school")}</TableHead>}
                  <TableHead>{t("academics.columnTimetableEntries")}</TableHead>
                  <TableHead>{t("academics.columnAssignments")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject: Subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="font-mono text-xs">{subject.code}</TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-sm text-slate-600">
                        {schoolNameMap[subject.schoolId] || "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-slate-600">
                      {subject._count?.timetableEntries ?? 0}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {subject._count?.assignments ?? 0}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(subject)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDelete(subject)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {(data?.meta?.totalPages || 1) > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                {t("common.pageOf", { page, total: data?.meta?.totalPages ?? 1 })}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {t("common.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (data?.meta?.totalPages || 1)}
                  onClick={() => setPage(page + 1)}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}