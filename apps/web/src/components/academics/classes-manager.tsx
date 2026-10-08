"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Sparkles, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { api, getErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/language-provider";

interface ClassRow {
  id: string;
  name: string;
  code: string;
  sections: { id: string; name: string; _count?: { students: number } }[];
  _count?: { students: number };
}

/** Classes & Sections manager. Lets a school admin create the academic
 *  structure that admission/attendance/fees dropdowns depend on, plus a
 *  one-click setup of the default LKG–12 structure for new schools. */
export function ClassesManager({ schoolId }: { schoolId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sectionInputs, setSectionInputs] = useState<Record<string, string>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["school-classes"] });
    queryClient.invalidateQueries({ queryKey: ["classes-list"] });
    queryClient.invalidateQueries({ queryKey: ["subjects-stats"] });
  };

  const classesQuery = useQuery({
    queryKey: ["school-classes", schoolId],
    queryFn: async () => {
      const response = await api.get(`/schools/${schoolId}/classes`);
      return (response.data.data || []) as ClassRow[];
    },
    enabled: !!schoolId,
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/schools/${schoolId}/classes/setup-defaults`);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success(t("academics.setupDone"));
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/schools/${schoolId}/classes`, { name, code });
    },
    onSuccess: () => {
      toast.success(t("academics.classAdded"));
      setName("");
      setCode("");
      setShowForm(false);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const sectionMutation = useMutation({
    mutationFn: async ({ classId, sectionName }: { classId: string; sectionName: string }) => {
      await api.post(`/schools/${schoolId}/classes/${classId}/sections`, {
        name: sectionName,
      });
    },
    onSuccess: (_data, vars) => {
      toast.success(t("academics.sectionAdded"));
      setSectionInputs((prev) => ({ ...prev, [vars.classId]: "" }));
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (classId: string) => {
      await api.delete(`/schools/${schoolId}/classes/${classId}`);
    },
    onSuccess: () => {
      toast.success(t("academics.classDeleted"));
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async ({ classId, sectionId }: { classId: string; sectionId: string }) => {
      await api.delete(`/schools/${schoolId}/classes/${classId}/sections/${sectionId}`);
    },
    onSuccess: () => {
      toast.success(t("academics.sectionDeleted"));
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const classes = classesQuery.data || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{t("academics.classesTitle")}</CardTitle>
            <CardDescription>{t("academics.classesSubtitle")}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="me-2 h-4 w-4" />
              )}
              {setupMutation.isPending ? t("academics.settingUp") : t("academics.setupDefaults")}
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="me-2 h-4 w-4" />
              {t("academics.addClass")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {classes.length > 0 && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {t("academics.setupDefaultsDesc")}
          </p>
        )}

        {showForm && (
          <form
            className="grid grid-cols-1 gap-3 rounded-lg border border-primary-200 bg-primary-50/30 p-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("academics.classNameLabel")} *
              </label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("academics.classNamePlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("academics.classCodeLabel")} *
              </label>
              <Input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t("academics.classCodePlaceholder")}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                )}
                {t("academics.addClass")}
              </Button>
            </div>
          </form>
        )}

        {classesQuery.isLoading ? (
          <LoadingState />
        ) : classesQuery.isError ? (
          <ErrorState
            message={t("academics.classesLoadFailed")}
            onRetry={() => classesQuery.refetch()}
          />
        ) : classes.length === 0 ? (
          <EmptyState
            title={t("academics.noClasses")}
            description={t("academics.noClassesDesc")}
            action={
              <Button
                variant="outline"
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
              >
                <Sparkles className="me-2 h-4 w-4" />
                {t("academics.setupDefaults")}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {classes.map((cls) => (
              <div key={cls.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-700">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{cls.name}</p>
                      <p className="font-mono text-xs text-slate-400">{cls.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {t("academics.studentsCount", { n: cls._count?.students ?? 0 })}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (window.confirm(t("academics.deleteClassConfirm", { name: cls.name }))) {
                          deleteClassMutation.mutate(cls.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cls.sections.map((section) => (
                    <span
                      key={section.id}
                      className="group inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {section.name}
                      <button
                        type="button"
                        className="text-slate-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                        title={t("common.delete")}
                        onClick={() => {
                          if (
                            window.confirm(
                              t("academics.deleteSectionConfirm", {
                                name: section.name,
                                clazz: cls.name,
                              })
                            )
                          ) {
                            deleteSectionMutation.mutate({
                              classId: cls.id,
                              sectionId: section.id,
                            });
                          }
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = (sectionInputs[cls.id] || "").trim();
                    if (!value) return;
                    sectionMutation.mutate({ classId: cls.id, sectionName: value });
                  }}
                >
                  <Input
                    className="h-8 text-xs"
                    value={sectionInputs[cls.id] || ""}
                    onChange={(e) =>
                      setSectionInputs((prev) => ({ ...prev, [cls.id]: e.target.value }))
                    }
                    placeholder={t("academics.sectionNamePlaceholder")}
                    maxLength={10}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={sectionMutation.isPending}
                  >
                    {t("academics.addSection")}
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
