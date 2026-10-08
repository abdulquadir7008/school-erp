"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Building2,
  X,
  Pencil,
  Trash2,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface School {
  id: string;
  name: string;
  schoolCode: string;
  email: string;
  adminEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  city: string;
  state: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
  _count: {
    students: number;
    teachers: number;
    branches: number;
  };
}

interface SchoolFormValues {
  name: string;
  schoolCode: string;
  email: string;
  phone: string;
  password: string;
  city: string;
  state: string;
  address: string;
}

export default function SchoolsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.roleName === "SUPER_ADMIN";
  const { t } = useI18n();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["schools", search, page],
    queryFn: async () => {
      const response = await api.get("/schools", {
        params: { search, page, limit: 10 },
      });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      await api.post("/schools", formData);
    },
    onSuccess: () => {
      toast.success(t("schools.createdToast"));
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      await api.put(`/schools/${id}`, formData);
    },
    onSuccess: () => {
      toast.success(t("schools.updatedToast"));
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/schools/${id}`);
    },
    onSuccess: () => {
      toast.success(t("schools.deletedToast"));
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.patch(`/schools/${id}/password`, { password });
    },
    onSuccess: () => {
      toast.success(t("schools.passwordResetToast"));
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/schools/${id}/status`, { status });
    },
    onSuccess: () => {
      toast.success(t("schools.statusUpdatedToast"));
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const [form, setForm] = useState<SchoolFormValues>({
    name: "",
    schoolCode: "",
    email: "",
    phone: "",
    password: "",
    city: "",
    state: "",
    address: "",
  });

  const resetForm = () =>
    setForm({
      name: "",
      schoolCode: "",
      email: "",
      phone: "",
      password: "",
      city: "",
      state: "",
      address: "",
    });

  const handleDelete = (school: School) => {
    if (
      window.confirm(t("schools.deleteConfirm", { name: school.name }))
    ) {
      deleteMutation.mutate(school.id);
    }
  };

  if (isLoading) return <LoadingState label={t("schools.loading")} />;
  if (isError) return <ErrorState message={t("schools.loadError")} onRetry={() => refetch()} />;

  const schools = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.schools")}</h1>
          <p className="text-sm text-slate-500">
            {t("schools.subtitle")}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="ms-2 h-4 w-4" />
            {t("schools.addSchool")}
          </Button>
        )}
      </div>

      {showCreate && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="text-base">{t("schools.registerNewSchool")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(form);
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("schools.schoolName")}</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("schools.schoolNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("schools.schoolCode")}</label>
                <Input
                  required
                  value={form.schoolCode}
                  onChange={(e) => setForm({ ...form, schoolCode: e.target.value })}
                  placeholder={t("schools.schoolCodePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.email")}</label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="info@school.edu"
                />
                <span className="text-xs text-slate-400">{t("schools.loginEmailHint")}</span>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("schools.password")} *
                </label>
                <Input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={t("schools.passwordPlaceholder")}
                />
                <span className="text-xs text-slate-400">{t("schools.forAdminLoginHint")}</span>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.phone")}</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("schools.city")}</label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder={t("schools.cityPlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("schools.state")}</label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder={t("schools.statePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.address")}</label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder={t("schools.addressPlaceholder")}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t("schools.creating") : t("schools.createSchool")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("schools.allSchools")}</CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="w-64 ps-9"
                placeholder={t("schools.searchPlaceholder")}
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
          {schools.length === 0 ? (
            <EmptyState
              title={t("schools.noSchools")}
              description={t("schools.noSchoolsDesc")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("schools.school")}</TableHead>
                  <TableHead>{t("common.code")}</TableHead>
                  <TableHead>{t("schools.location")}</TableHead>
                  <TableHead>{t("schools.stats")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school: School) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100">
                          <Building2 className="h-4 w-4 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium">{school.name}</p>
                          <p className="text-xs text-slate-500">{school.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{school.schoolCode}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {school.city ? `${school.city}, ${school.state}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-3 text-xs">
                        <span className="text-slate-500">{t("schools.studentsCount", { n: school._count?.students ?? 0 })}</span>
                        <span className="text-slate-500">{t("schools.teachersCount", { n: school._count?.teachers ?? 0 })}</span>
                        <span className="text-slate-500">{t("schools.branchesCount", { n: school._count?.branches ?? 0 })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          school.status === "ACTIVE"
                            ? "success"
                            : school.status === "INACTIVE"
                              ? "secondary"
                              : "danger"
                        }
                      >
                        {school.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(school)}
                          >
                            <Pencil className="ms-1 h-3.5 w-3.5" />
                            {t("common.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              statusMutation.mutate({
                                id: school.id,
                                status:
                                  school.status === "ACTIVE"
                                    ? "INACTIVE"
                                    : "ACTIVE",
                              })
                            }
                          >
                            {school.status === "ACTIVE" ? (
                              <>
                                <Ban className="ms-1 h-3.5 w-3.5" />
                                {t("schools.deactivate")}
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="ms-1 h-3.5 w-3.5" />
                                {t("schools.activate")}
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(school)}
                          >
                            <Trash2 className="ms-1 h-3.5 w-3.5" />
                            {t("common.delete")}
                          </Button>
                        </div>
                      )}
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
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

      {editing && (
        <EditSchoolModal
          school={editing}
          isPending={updateMutation.isPending}
          isResetting={resetPasswordMutation.isPending}
          resetError={
            resetPasswordMutation.error
              ? getErrorMessage(resetPasswordMutation.error)
              : undefined
          }
          error={
            updateMutation.error
              ? getErrorMessage(updateMutation.error)
              : undefined
          }
          onClose={() => setEditing(null)}
          onSubmit={(formData) =>
            updateMutation.mutate({ id: editing.id, formData })
          }
          onResetPassword={(password) =>
            resetPasswordMutation.mutate({ id: editing.id, password })
          }
        />
      )}
    </div>
  );
}

function EditSchoolModal({
  school,
  isPending,
  isResetting,
  error,
  resetError,
  onClose,
  onSubmit,
  onResetPassword,
}: {
  school: School;
  isPending: boolean;
  isResetting: boolean;
  error?: string;
  resetError?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onResetPassword: (password: string) => void;
}) {
  const [form, setForm] = useState({
    name: school.name,
    schoolCode: school.schoolCode,
    email: school.email,
    phone: school.phone || "",
    city: school.city || "",
    state: school.state || "",
    address: school.address || "",
  });
  const [newPassword, setNewPassword] = useState("");
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("schools.editSchool")}</h2>
            <p className="text-sm text-slate-500">{school.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name: form.name,
              email: form.email,
              phone: form.phone || undefined,
              city: form.city || undefined,
              state: form.state || undefined,
              address: form.address || undefined,
            });
          }}
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("schools.schoolName")}</label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("schools.schoolCode")}</label>
            <Input value={form.schoolCode} disabled />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.email")}</label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <span className="text-xs text-slate-400">
              {t("schools.alsoLoginEmail")}
            </span>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.phone")}</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("schools.city")}</label>
            <Input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("schools.state")}</label>
            <Input
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("common.address")}</label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="border-t border-slate-100 pt-4 text-sm font-semibold text-slate-900">
                {t("schools.resetAdminPassword")}
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {t("schools.resetPasswordHint", { email: school.adminEmail || school.email })}
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={t("schools.newPasswordPlaceholder")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={isResetting || newPassword.length < 6}
                onClick={() => {
                  onResetPassword(newPassword);
                }}
              >
                {isResetting ? t("schools.resetting") : t("schools.reset")}
              </Button>
            </div>
            {resetError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {resetError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}