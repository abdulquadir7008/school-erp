"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Plus,
  ShieldCheck,
  Lock,
  UserCog,
  X,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  schoolId: string | null;
  editable: boolean;
  userCount: number;
  permissions: string[];
}

interface PermissionDef {
  action: string;
  name: string;
}

interface ModuleDef {
  module: string;
  permissions: PermissionDef[];
}

interface RolesData {
  roles: Role[];
  modules: ModuleDef[];
}

const ACTION_KEYS: Record<string, string> = {
  view: "settings.roles.actionView",
  create: "settings.roles.actionCreate",
  edit: "settings.roles.actionEdit",
  delete: "settings.roles.actionDelete",
};

export default function SettingsRolesPage() {
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const schoolId = user?.school?.id || user?.schoolId || "";
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const queryKey = ["settings-roles", schoolId || "none"];

  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });

  const { data, isLoading, isError, refetch } = useQuery<RolesData>({
    queryKey,
    queryFn: async () => {
      const params = isSuperAdmin && schoolId ? { schoolId } : {};
      const response = await api.get("/settings/roles", { params });
      return response.data.data;
    },
    enabled: Boolean(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: async (role: { name: string; description: string }) => {
      const params = isSuperAdmin && schoolId ? `?schoolId=${schoolId}` : "";
      await api.post(`/settings/roles${params}`, role);
    },
    onSuccess: () => {
      toast.success(t("settings.roles.created"));
      setShowCreate(false);
      setNewRole({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      roleId,
      permissions,
    }: {
      roleId: string;
      permissions: string[];
    }) => {
      await api.put(`/settings/roles/${roleId}`, { permissions });
    },
    onSuccess: () => {
      toast.success(t("settings.roles.permissionsUpdated"));
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const selected = useMemo(
    () => data?.roles.find((r) => r.id === selectedId) || null,
    [data, selectedId]
  );

  const toggled = useMemo(
    () => new Set(selected?.permissions || []),
    [selected]
  );

  const togglePermission = (name: string) => {
    if (!selected || !selected.editable) return;
    const next = new Set(toggled);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    saveMutation.mutate({ roleId: selected.id, permissions: [...next] });
  };

  if (isLoading)
    return <LoadingState label={t("settings.roles.loading")} />;
  if (isError)
    return (
      <ErrorState
        message={t("settings.roles.failed")}
        onRetry={() => refetch()}
      />
    );
  if (!schoolId)
    return (
      <EmptyState
        title={t("settings.roles.noSchool")}
        description={t("settings.roles.noSchoolDesc")}
      />
    );

  const roles = data?.roles || [];
  const modules = data?.modules || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <Users className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {t("settings.roles.title")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("settings.roles.subtitle")}
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.roles.createRole")}
            </Button>
          </div>

          {showCreate && (
            <form
              className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-primary-200 bg-primary-50/40 p-4 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  newRole.name.trim().length >= 2
                ) {
                  createMutation.mutate(newRole);
                }
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("settings.roles.roleName")}
                </label>
                <Input
                  required
                  value={newRole.name}
                  onChange={(e) =>
                    setNewRole({ ...newRole, name: e.target.value })
                  }
                  placeholder={t("settings.roles.roleNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("settings.roles.description")}
                </label>
                <Input
                  value={newRole.description}
                  onChange={(e) =>
                    setNewRole({ ...newRole, description: e.target.value })
                  }
                  placeholder={t("settings.roles.descriptionPlaceholder")}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending
                    ? t("common.creating")
                    : t("common.create")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  {t("settings.roles.cancel")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit">
          <CardContent className="p-2">
            <div className="space-y-0.5">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedId(role.id)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selectedId === role.id
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {role.isSystem ? (
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <UserCog className="h-3.5 w-3.5 text-primary-500" />
                    )}
                    {role.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {role.userCount}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {!selected ? (
              <EmptyState
                title={t("settings.roles.selectRole")}
                description={t("settings.roles.selectRoleDesc")}
              />
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                      <ShieldCheck className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {selected.name}
                        </h3>
                        {selected.isSystem ? (
                          <Badge variant="secondary">
                            {t("settings.roles.system")}
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            {t("settings.roles.custom")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {selected.description || t("settings.roles.noDescription")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {t("settings.roles.permissionsCount", {
                          n: selected.permissions.length,
                        })}{" "}
                        ·{" "}
                        {t("settings.roles.usersCount", {
                          n: selected.userCount,
                        })}
                      </p>
                    </div>
                  </div>
                  {selected.editable && (
                    <p className="text-xs text-slate-400">
                      {t("settings.roles.autoSaveHint")}
                    </p>
                  )}
                </div>

                {!selected.editable && (
                  <div className="flex items-center gap-2 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <Lock className="h-4 w-4" />
                    {t("settings.roles.readOnlyNote")}
                  </div>
                )}

                <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
                  {modules.map((mod) => {
                    const checkedCount = mod.permissions.filter((p) =>
                      toggled.has(p.name)
                    ).length;
                    return (
                      <div key={mod.module}>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                            {mod.module}
                          </h4>
                          <span className="text-xs text-slate-400">
                            {checkedCount}/{mod.permissions.length}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {mod.permissions.map((perm) => {
                            const checked = toggled.has(perm.name);
                            return (
                              <button
                                key={perm.name}
                                type="button"
                                disabled={!selected.editable}
                                onClick={() => togglePermission(perm.name)}
                                className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                  checked
                                    ? "border-primary-200 bg-primary-50 text-primary-700"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <span className="capitalize">
                                  {ACTION_KEYS[perm.action]
                                    ? t(ACTION_KEYS[perm.action])
                                    : perm.action}
                                </span>
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                                    checked
                                      ? "border-primary-600 bg-primary-600 text-white"
                                      : "border-slate-300"
                                  }`}
                                >
                                  {checked ? "✓" : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {saveMutation.isPending && (
                  <p className="text-xs text-slate-400">
                    {t("settings.roles.saving")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && selected.userCount === 0 && selected.editable && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {t("settings.roles.dangerZone")}
                </h3>
                <p className="text-sm text-slate-500">
                  {t("settings.roles.safeToRemove")}
                </p>
              </div>
              <Button
                variant="outline"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("settings.roles.deleteSoon")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selected && showCreate && (
        <Button
          variant="ghost"
          className="text-slate-500"
          onClick={() => setShowCreate(false)}
        >
          <X className="mr-2 h-4 w-4" />
          {t("common.close")}
        </Button>
      )}
    </div>
  );
}
