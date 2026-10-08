"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Download, Plus, Users, Phone, Mail, Loader2, Building2, BookOpen, GraduationCap, UserPlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
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

interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  occupation?: string | null;
  createdAt: string;
  school?: { id: string; name: string } | null;
  students: {
    student: {
      id: string;
      firstName: string;
      lastName: string;
      admissionNumber: string;
      class?: { id: string; name: string } | null;
    };
  }[];
}

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  schoolId: "",
  classId: "",
  studentId: "",
};

export default function ParentsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";

  const effectiveSchoolId = isSuperAdmin ? form.schoolId : user?.schoolId || "";

  const resetForm = () => setForm(emptyForm);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parents", search, page],
    queryFn: async () => {
      const response = await api.get("/parents", {
        params: { search, page, limit: 15 },
      });
      return response.data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ["parents-stats"],
    queryFn: async () => {
      const response = await api.get("/parents/dashboard");
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

  const classesQuery = useQuery({
    queryKey: ["classes-list", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get(`/schools/${effectiveSchoolId}/classes`);
      return response.data.data || [];
    },
    enabled: !!effectiveSchoolId,
  });

  const studentsQuery = useQuery({
    queryKey: ["students-list", effectiveSchoolId, form.classId],
    queryFn: async () => {
      const response = await api.get("/students", {
        params: { classId: form.classId, limit: 100 },
      });
      return response.data.data || [];
    },
    enabled: !!(effectiveSchoolId && form.classId),
  });

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      await api.post("/parents", formData);
    },
    onSuccess: () => {
      toast.success(t("parents.added"));
      setShowAdd(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["parents-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      await api.put(`/parents/${id}`, formData);
    },
    onSuccess: () => {
      toast.success(t("parents.updated"));
      setShowAdd(false);
      setEditingParent(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["parents-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/parents/${id}`);
    },
    onSuccess: () => {
      toast.success(t("parents.deleted"));
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["parents-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stats = statsQuery.data || {};
  const parents = data?.data || [];

  const startEdit = (parent: Parent) => {
    const linkedStudent = parent.students?.[0]?.student;
    setShowAdd(true);
    setEditingParent(parent);
    setForm({
      firstName: parent.firstName,
      lastName: parent.lastName,
      phone: parent.phone,
      email: parent.email || "",
      schoolId: parent.school?.id || user?.schoolId || "",
      classId: linkedStudent?.class?.id || "",
      studentId: linkedStudent?.id || "",
    });
  };

  const confirmDelete = (parent: Parent) => {
    if (
      window.confirm(
        t("parents.deleteConfirm", {
          name: `${parent.firstName} ${parent.lastName}`,
        })
      )
    ) {
      deleteMutation.mutate(parent.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.parents")}</h1>
          <p className="text-sm text-slate-500">{t("parents.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="me-2 h-4 w-4" />
            {t("common.export")}
          </Button>
          <Button
            onClick={() => {
              setShowAdd(!showAdd);
              setEditingParent(null);
              if (!showAdd) resetForm();
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            {t("parents.addParent")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("parents.statsTotal")} value={String(stats.total || 0)} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
        <StatCard title={t("parents.statsNewThisMonth")} value={String(stats.newThisMonth || 0)} icon={<Users className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
      </div>

      {showAdd && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="text-base">
              <UserPlus className="me-1 inline h-4 w-4" />
              {editingParent
                ? t("parents.editParent", {
                    name: `${editingParent.firstName} ${editingParent.lastName}`,
                  })
                : t("parents.addParent")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (editingParent) {
                  const payload: any = {
                    firstName: form.firstName,
                    lastName: form.lastName,
                    phone: form.phone,
                  };
                  if (form.email) payload.email = form.email;
                  payload.studentId = form.studentId || null;
                  updateMutation.mutate({ id: editingParent.id, formData: payload });
                  return;
                }
                const payload: any = {
                  firstName: form.firstName,
                  lastName: form.lastName,
                  phone: form.phone,
                  relation: "PARENT",
                };
                if (form.email) payload.email = form.email;
                if (form.studentId) payload.studentId = form.studentId;
                payload.schoolId = effectiveSchoolId;
                createMutation.mutate(payload);
              }}
            >
              {isSuperAdmin && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    <Building2 className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                    {t("parents.school")} *
                  </label>
                  <select
                    required
                    disabled={!!editingParent}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    value={form.schoolId}
                    onChange={(e) =>
                      setForm({ ...form, schoolId: e.target.value, classId: "", studentId: "" })
                    }
                  >
                    <option value="">{t("parents.selectSchool")}</option>
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
                  <BookOpen className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("parents.studentClass")} *
                </label>
                <select
                  required
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value, studentId: "" })}
                  disabled={!effectiveSchoolId}
                >
                  <option value="">
                    {!effectiveSchoolId ? t("parents.selectSchoolFirst") : t("parents.selectClass")}
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
                  <GraduationCap className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("parents.student")}
                </label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  disabled={!form.classId}
                >
                  <option value="">
                    {!form.classId ? t("parents.selectClassFirst") : t("parents.selectStudentOptional")}
                  </option>
                  {(studentsQuery.data || []).map((student: any) => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName} ({student.admissionNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("parents.firstName")} *</label>
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder={t("parents.firstNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("parents.lastName")} *</label>
                <Input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder={t("parents.lastNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <Phone className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("parents.contact")} *
                </label>
                <Input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder={t("parents.contactPlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <Mail className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("common.email")}
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={t("parents.emailPlaceholder")}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {createMutation.isPending || updateMutation.isPending
                    ? t("common.saving")
                    : editingParent
                      ? t("parents.saveChanges")
                      : t("parents.addParent")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("parents.accounts")}</CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="w-64 ps-9"
                placeholder={t("parents.searchPlaceholder")}
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
            <ErrorState message={t("parents.loadError")} onRetry={() => refetch()} />
          ) : parents.length === 0 ? (
            <EmptyState
              title={t("parents.emptyTitle")}
              description={
                search
                  ? t("parents.emptySearch")
                  : t("parents.emptyStart")
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("parents.colParent")}</TableHead>
                  <TableHead>{t("parents.contact")}</TableHead>
                  <TableHead>{t("parents.colLinkedStudents")}</TableHead>
                  <TableHead>{t("parents.colAdded")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parents.map((parent: Parent) => (
                  <TableRow key={parent.id}>
                    <TableCell className="font-medium">
                      {parent.firstName} {parent.lastName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {parent.phone}
                        </span>
                        {parent.email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {parent.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {parent.students?.length
                        ? parent.students
                            .map((s) => {
                              const cls = s.student.class?.name;
                              return `${s.student.firstName} ${s.student.lastName}${cls ? ` (${cls})` : ""}`;
                            })
                            .join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {new Date(parent.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(parent)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDelete(parent)}>
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
                {t("common.pageOf", { page, total: data?.meta?.totalPages })}
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
    </div>
  );
}