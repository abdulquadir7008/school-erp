"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Download, Plus, Users, Loader2, Building2, BookOpen, Layers, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  admissionDate: string;
  status: string;
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
  school: { id: string; name: string };
}

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdmit, setShowAdmit] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    admissionNumber: "",
    firstName: "",
    lastName: "",
    gender: "MALE",
    schoolId: "",
    classId: "",
    sectionId: "",
  });
  const resetForm = () =>
    setForm({
      admissionNumber: "",
      firstName: "",
      lastName: "",
      gender: "MALE",
      schoolId: "",
      classId: "",
      sectionId: "",
    });
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";
  const { t } = useI18n();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["students", search, page],
    queryFn: async () => {
      const response = await api.get("/students", {
        params: { search, page, limit: 15 },
      });
      return response.data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ["students-stats"],
    queryFn: async () => {
      const response = await api.get("/students/dashboard");
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

  const effectiveSchoolId = isSuperAdmin ? form.schoolId : user?.schoolId || "";

  const classesQuery = useQuery({
    queryKey: ["classes-list", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get(`/schools/${effectiveSchoolId}/classes`);
      return response.data.data || [];
    },
    enabled: !!effectiveSchoolId,
  });

  const sectionsQuery = useQuery({
    queryKey: ["sections-list", effectiveSchoolId, form.classId],
    queryFn: async () => {
      const response = await api.get(
        `/schools/${effectiveSchoolId}/classes/${form.classId}/sections`
      );
      return response.data.data || [];
    },
    enabled: !!(effectiveSchoolId && form.classId),
  });

  const admitMutation = useMutation({
    mutationFn: async (formData: any) => {
      await api.post("/students", formData);
    },
    onSuccess: () => {
      toast.success(t("students.admittedToast"));
      setShowAdmit(false);
      setEditingStudent(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const editStudentMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      await api.put(`/students/${id}`, formData);
    },
    onSuccess: () => {
      toast.success(t("students.updatedToast"));
      setShowAdmit(false);
      setEditingStudent(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/students/${id}`);
    },
    onSuccess: () => {
      toast.success(t("students.deletedToast"));
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students-stats"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stats = statsQuery.data || {};
  const students = data?.data || [];

  const startEdit = (student: Student) => {
    setShowAdmit(true);
    setEditingStudent(student);
    setForm({
      admissionNumber: student.admissionNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
      schoolId: student.school?.id || "",
      classId: student.class?.id || "",
      sectionId: student.section?.id || "",
    });
  };

  const confirmDelete = (student: Student) => {
    if (window.confirm(t("students.deleteConfirm", { name: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber }))) {
      deleteStudentMutation.mutate(student.id);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.students")}</h1>
          <p className="text-sm text-slate-500">
            {t("students.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="ms-2 h-4 w-4" />
            {t("common.export")}
          </Button>
          <Button
            onClick={() => {
              setShowAdmit(!showAdmit);
              setEditingStudent(null);
              if (!showAdmit) resetForm();
            }}
          >
            <Plus className="ms-2 h-4 w-4" />
            {editingStudent ? t("students.newAdmission") : t("students.admitStudent")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("students.totalStudents")} value={String(stats.total || 0)} change={t("students.statThisMonth", { n: 12 })} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
        <StatCard title={t("common.active")} value={String(stats.active || 0)} icon={<Users className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
        <StatCard title={t("students.male")} value={String(stats.male || 0)} icon={<Users className="h-5 w-5" />} iconBg="bg-purple-50 text-purple-600" />
        <StatCard title={t("students.female")} value={String(stats.female || 0)} icon={<Users className="h-5 w-5" />} iconBg="bg-pink-50 text-pink-600" />
      </div>

      {showAdmit && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editingStudent ? t("students.editStudentTitle", { number: editingStudent.admissionNumber }) : t("students.newStudentAdmission")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (editingStudent) {
                  const payload: any = {
                    firstName: form.firstName,
                    lastName: form.lastName,
                    gender: form.gender,
                    classId: form.classId,
                    sectionId: form.sectionId,
                  };
                  editStudentMutation.mutate({ id: editingStudent.id, formData: payload });
                  return;
                }
                const payload: any = {
                  admissionNumber: form.admissionNumber,
                  firstName: form.firstName,
                  lastName: form.lastName,
                  gender: form.gender,
                  classId: form.classId,
                };
                if (isSuperAdmin && form.schoolId) payload.schoolId = form.schoolId;
                if (form.sectionId) payload.sectionId = form.sectionId;
                admitMutation.mutate(payload);
              }}
            >
              {isSuperAdmin && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    <Building2 className="ms-1 inline h-3.5 w-3.5 text-slate-400" />
                    {t("students.school")} {editingStudent ? "" : "*"}
                  </label>
                  <select
                    required
                    disabled={!!editingStudent}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    value={form.schoolId}
                    onChange={(e) =>
                      setForm({ ...form, schoolId: e.target.value, classId: "", sectionId: "" })
                    }
                  >
                    <option value="">{t("students.selectSchool")}</option>
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
                  <BookOpen className="ms-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("students.class")} *
                </label>
                <select
                  required
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: "" })}
                  disabled={!effectiveSchoolId}
                >
                  <option value="">
                    {!effectiveSchoolId ? t("students.selectSchoolFirst") : t("students.selectClass")}
                  </option>
                  {(classesQuery.data || []).map((cls: any) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                {effectiveSchoolId &&
                  !classesQuery.isLoading &&
                  (classesQuery.data || []).length === 0 && (
                    <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                      {t("students.noClassesHint")}{" "}
                      <Link href="/academics" className="font-semibold underline">
                        {t("students.setupClassesCta")}
                      </Link>
                    </p>
                  )}
              </div>
              {form.classId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    <Layers className="ms-1 inline h-3.5 w-3.5 text-slate-400" />
                    {t("students.section")}
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    value={form.sectionId}
                    onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                  >
                    <option value="">{t("students.selectSection")}</option>
                    {(sectionsQuery.data || []).map((sec: any) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!editingStudent && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("students.admissionNumber")}</label>
                  <Input required value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} placeholder={t("students.admissionNumberPlaceholder")} />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("students.firstName")}</label>
                <Input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder={t("students.firstNamePlaceholder")} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("students.lastName")}</label>
                <Input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder={t("students.lastNamePlaceholder")} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("students.gender")}</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="MALE">{t("students.genderMale")}</option>
                  <option value="FEMALE">{t("students.genderFemale")}</option>
                  <option value="OTHER">{t("students.genderOther")}</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={admitMutation.isPending || editStudentMutation.isPending}>
                  {admitMutation.isPending || editStudentMutation.isPending ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {admitMutation.isPending || editStudentMutation.isPending
                    ? t("common.saving")
                    : editingStudent
                      ? t("students.saveChanges")
                      : t("students.confirmAdmission")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("students.allStudents")}</CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="w-64 ps-9"
                placeholder={t("students.searchPlaceholder")}
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
            <ErrorState message={t("students.loadError")} onRetry={() => refetch()} />
          ) : students.length === 0 ? (
            <EmptyState
              title={t("students.noStudents")}
              description={
                search
                  ? t("students.noSearchResults")
                  : t("students.admitFirst")
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("students.student")}</TableHead>
                  <TableHead>{t("students.admissionNumber")}</TableHead>
                  {isSuperAdmin && <TableHead>{t("students.school")}</TableHead>}
                  <TableHead>{t("students.class")}</TableHead>
                  <TableHead>{t("students.gender")}</TableHead>
                  <TableHead>{t("students.admissionDate")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student: Student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.firstName} {student.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {student.admissionNumber}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-sm text-slate-600">
                        {student.school?.name || "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      {student.class?.name || "-"}
                      {student.section?.name ? ` - ${student.section.name}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{student.gender}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {new Date(student.admissionDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={student.status === "ACTIVE" ? "success" : "secondary"}
                      >
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(student)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDelete(student)}>
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