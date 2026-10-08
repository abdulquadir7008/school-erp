"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, Download, BookOpen, UserCheck, ClipboardList, Mail, Phone, Loader2, Building2, UserPlus, Pencil, Trash2, GraduationCap, Briefcase, BadgeCheck, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
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

interface Teacher {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  joiningDate?: string | null;
  status: string;
  createdAt: string;
  school?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
}

const emptyForm = {
  employeeId: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  qualification: "",
  specialization: "",
  joiningDate: "",
  status: "ACTIVE",
  schoolId: "",
};

export default function TeachersPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";

  const effectiveSchoolId = isSuperAdmin ? form.schoolId : user?.schoolId || "";

  const resetForm = () => setForm(emptyForm);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["teachers", search, page],
    queryFn: async () => {
      const response = await api.get("/teachers", {
        params: { search, page, limit: 15 },
      });
      return response.data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ["teachers-stats"],
    queryFn: async () => {
      const response = await api.get("/teachers/dashboard");
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

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      await api.post("/teachers", formData);
    },
    onSuccess: () => {
      toast.success(t("teachers.added"));
      setShowForm(false);
      setEditingTeacher(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      await api.put(`/teachers/${id}`, formData);
    },
    onSuccess: () => {
      toast.success(t("teachers.updated"));
      setShowForm(false);
      setEditingTeacher(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/teachers/${id}`);
    },
    onSuccess: () => {
      toast.success(t("teachers.removed"));
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stats = statsQuery.data || {};
  const teachers = data?.data || [];

  const startEdit = (teacher: Teacher) => {
    setShowForm(true);
    setEditingTeacher(teacher);
    setForm({
      employeeId: teacher.employeeId,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      phone: teacher.phone || "",
      email: teacher.email || "",
      qualification: teacher.qualification || "",
      specialization: teacher.specialization || "",
      joiningDate: teacher.joiningDate ? teacher.joiningDate.slice(0, 10) : "",
      status: teacher.status || "ACTIVE",
      schoolId: teacher.school?.id || user?.schoolId || "",
    });
  };

  const confirmDelete = (teacher: Teacher) => {
    if (
      window.confirm(
        t("teachers.deleteConfirm", {
          name: `${teacher.firstName} ${teacher.lastName}`,
          employeeId: teacher.employeeId,
        })
      )
    ) {
      deleteMutation.mutate(teacher.id);
    }
  };

  const toggleStatus = (teacher: Teacher) => {
    const newStatus = teacher.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    updateMutation.mutate({
      id: teacher.id,
      formData: { status: newStatus },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.teachers")}</h1>
          <p className="text-sm text-slate-500">{t("teachers.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="me-2 h-4 w-4" />{t("common.export")}</Button>
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditingTeacher(null);
              if (!showForm) resetForm();
            }}
          >
            <Plus className="me-2 h-4 w-4" />{t("teachers.addTeacher")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("teachers.statsTotal")} value={String(stats.total || 0)} icon={<BookOpen className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
        <StatCard title={t("common.active")} value={String(stats.active || 0)} icon={<UserCheck className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
        <StatCard title={t("teachers.onLeave")} value={String(stats.onLeave || 0)} icon={<ClipboardList className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
      </div>

      {showForm && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="text-base">
              <UserPlus className="me-1 inline h-4 w-4" />
              {editingTeacher
                ? t("teachers.editTeacher", {
                    name: `${editingTeacher.firstName} ${editingTeacher.lastName}`,
                  })
                : t("teachers.addTeacher")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (editingTeacher) {
                  const payload: any = {
                    employeeId: form.employeeId,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    phone: form.phone,
                    status: form.status,
                  };
                  if (form.email) payload.email = form.email;
                  if (form.qualification) payload.qualification = form.qualification;
                  if (form.specialization) payload.specialization = form.specialization;
                  if (form.joiningDate) payload.joiningDate = new Date(form.joiningDate).toISOString();
                  updateMutation.mutate({ id: editingTeacher.id, formData: payload });
                  return;
                }
                const payload: any = {
                  employeeId: form.employeeId,
                  firstName: form.firstName,
                  lastName: form.lastName,
                  phone: form.phone,
                  schoolId: effectiveSchoolId,
                };
                if (form.email) payload.email = form.email;
                if (form.qualification) payload.qualification = form.qualification;
                if (form.specialization) payload.specialization = form.specialization;
                if (form.joiningDate) payload.joiningDate = new Date(form.joiningDate).toISOString();
                createMutation.mutate(payload);
              }}
            >
              {isSuperAdmin && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    <Building2 className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                    {t("teachers.school")} *
                  </label>
                  <select
                    required
                    disabled={!!editingTeacher}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    value={form.schoolId}
                    onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                  >
                    <option value="">{t("teachers.selectSchool")}</option>
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
                  <BadgeCheck className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("teachers.id")} *
                </label>
                <Input
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  placeholder={t("teachers.idPlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("teachers.firstName")} *</label>
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder={t("teachers.firstNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("teachers.lastName")} *</label>
                <Input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder={t("teachers.lastNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <Phone className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("teachers.contact")} *
                </label>
                <Input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder={t("teachers.contactPlaceholder")}
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
                  placeholder={t("teachers.emailPlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <GraduationCap className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("teachers.qualification")}
                </label>
                <Input
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  placeholder={t("teachers.qualificationPlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <Briefcase className="me-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("teachers.specialization")}
                </label>
                <Input
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  placeholder={t("teachers.specializationPlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("teachers.joiningDate")}</label>
                <Input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                />
              </div>
              {editingTeacher && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.status")}</label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="ACTIVE">{t("common.active")}</option>
                    <option value="ON_LEAVE">{t("teachers.onLeave")}</option>
                    <option value="INACTIVE">{t("common.inactive")}</option>
                  </select>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {createMutation.isPending || updateMutation.isPending
                    ? t("common.saving")
                    : editingTeacher
                      ? t("teachers.saveChanges")
                      : t("teachers.addTeacher")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("teachers.teachingStaff")}</CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="w-64 ps-9"
                placeholder={t("teachers.searchPlaceholder")}
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
            <ErrorState message={t("teachers.loadError")} onRetry={() => refetch()} />
          ) : teachers.length === 0 ? (
            <EmptyState
              title={t("teachers.emptyTitle")}
              description={search ? t("teachers.emptySearch") : t("teachers.emptyStart")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("teachers.colTeacher")}</TableHead>
                  <TableHead>{t("teachers.colId")}</TableHead>
                  <TableHead>{t("teachers.contact")}</TableHead>
                  <TableHead>{t("teachers.specialization")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher: Teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">
                      {teacher.firstName} {teacher.lastName}
                      {teacher.qualification && (
                        <p className="mt-0.5 text-xs text-slate-500">{teacher.qualification}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{teacher.employeeId}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        {teacher.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {teacher.phone}
                          </span>
                        )}
                        {teacher.email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {teacher.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {teacher.specialization || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={teacher.status === "ACTIVE" ? "success" : "secondary"}>
                        {teacher.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={teacher.status === "ACTIVE" ? t("teachers.deactivate") : t("teachers.activate")}
                          onClick={() => toggleStatus(teacher)}
                        >
                          <Power
                            className={`h-4 w-4 ${teacher.status === "ACTIVE" ? "text-green-600" : "text-slate-400"}`}
                          />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(teacher)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDelete(teacher)}>
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