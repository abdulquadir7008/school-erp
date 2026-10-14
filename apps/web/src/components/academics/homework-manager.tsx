"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Search,
  Eye,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { useAuthStore } from "@/stores/auth-store";

interface HomeworkStats {
  total: number;
  completed: number;
  pending: number;
  notSubmitted: number;
  overdue: number;
}

interface HomeworkRow {
  id: string;
  title: string;
  description?: string | null;
  classId: string;
  sectionId?: string | null;
  subjectId?: string | null;
  homeworkDate: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  attachments?: string[] | null;
  class?: { id: string; name: string; code?: string } | null;
  section?: { id: string; name: string } | null;
  subject?: { id: string; name: string; code?: string } | null;
  teacher?: { id: string; firstName: string; lastName: string } | null;
  stats: HomeworkStats;
}

interface CompletionRow {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber?: number | null;
    section?: { id: string; name: string } | null;
  };
  submission: {
    status: "PENDING" | "COMPLETED" | "NOT_SUBMITTED";
    submittedAt?: string | null;
    teacherRemark?: string | null;
    submissionText?: string | null;
  };
}

const emptyForm = {
  title: "",
  description: "",
  classId: "",
  sectionId: "",
  subjectId: "",
  academicYearId: "",
  homeworkDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  priority: "MEDIUM",
  status: "PUBLISHED",
  attachments: "",
};

const statusVariant: Record<string, "success" | "warning" | "secondary" | "default"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  ARCHIVED: "secondary",
};

const priorityVariant: Record<string, "danger" | "warning" | "default" | "secondary"> = {
  URGENT: "danger",
  HIGH: "warning",
  MEDIUM: "default",
  LOW: "secondary",
};

function completionBadge(status: string) {
  if (status === "COMPLETED") return <Badge variant="success">Completed</Badge>;
  if (status === "NOT_SUBMITTED") return <Badge variant="danger">Not submitted</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export function HomeworkManager({ schoolId }: { schoolId: string }) {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission("homework.create");

  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HomeworkRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [completionSearch, setCompletionSearch] = useState("");
  const [completionFilter, setCompletionFilter] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { status: string; teacherRemark: string }>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["homework"] });
    queryClient.invalidateQueries({ queryKey: ["homework-completions"] });
  };

  const homeworkQuery = useQuery({
    queryKey: ["homework", schoolId, search, classId, sectionId, subjectId, status, overdueOnly],
    queryFn: async () => {
      const response = await api.get("/academics/homework", {
        params: {
          ...(classId ? { classId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(subjectId ? { subjectId } : {}),
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(overdueOnly ? { overdue: "true" } : {}),
        },
      });
      return (response.data.data || []) as HomeworkRow[];
    },
    enabled: !!schoolId,
  });

  const classesQuery = useQuery({
    queryKey: ["school-classes", schoolId],
    queryFn: async () => {
      const response = await api.get(`/schools/${schoolId}/classes`);
      return response.data.data || [];
    },
    enabled: !!schoolId,
  });

  const subjectsQuery = useQuery({
    queryKey: ["homework-subjects", schoolId],
    queryFn: async () => {
      const response = await api.get("/subjects", { params: { limit: 100 } });
      return response.data.data || [];
    },
    enabled: !!schoolId,
  });

  const yearsQuery = useQuery({
    queryKey: ["homework-years", schoolId],
    queryFn: async () => {
      try {
        const response = await api.get("/fees/academic-years");
        return response.data.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!schoolId,
  });

  const completionsQuery = useQuery({
    queryKey: ["homework-completions", detailId, completionSearch, completionFilter],
    queryFn: async () => {
      const response = await api.get(`/academics/homework/${detailId}/completions`, {
        params: {
          ...(completionSearch ? { search: completionSearch } : {}),
          ...(completionFilter ? { status: completionFilter } : {}),
        },
      });
      return response.data.data as { homework: HomeworkRow; students: CompletionRow[]; stats: HomeworkStats };
    },
    enabled: !!detailId,
  });

  const items = homeworkQuery.data || [];
  const classes: any[] = classesQuery.data || [];
  const subjects: any[] = subjectsQuery.data || [];
  const years: any[] = yearsQuery.data || [];
  const sectionsOf = (cid: string) => classes.find((c: any) => c.id === cid)?.sections || [];

  const totals = useMemo(() => {
    return items.reduce(
      (acc, h) => ({
        assigned: acc.assigned + h.stats.total,
        completed: acc.completed + h.stats.completed,
        pending: acc.pending + h.stats.pending + h.stats.notSubmitted,
        overdue: acc.overdue + h.stats.overdue,
      }),
      { assigned: 0, completed: 0, pending: 0, overdue: 0 }
    );
  }, [items]);

  const mutateOptions = (msg: string) => ({
    onSuccess: () => {
      toast.success(msg);
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      invalidate();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/academics/homework", {
        title: form.title,
        description: form.description || undefined,
        classId: form.classId,
        sectionId: form.sectionId || undefined,
        subjectId: form.subjectId || undefined,
        academicYearId: form.academicYearId || undefined,
        homeworkDate: form.homeworkDate || undefined,
        dueDate: form.dueDate,
        priority: form.priority,
        status: form.status,
        attachments: form.attachments
          ? form.attachments.split("\n").map((s) => s.trim()).filter(Boolean)
          : undefined,
      });
    },
    ...mutateOptions("Homework saved"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await api.put(`/academics/homework/${editing.id}`, {
        title: form.title,
        description: form.description || null,
        sectionId: form.sectionId || null,
        subjectId: form.subjectId || null,
        academicYearId: form.academicYearId || null,
        homeworkDate: form.homeworkDate || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
        status: form.status,
        attachments: form.attachments
          ? form.attachments.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
      });
    },
    ...mutateOptions("Homework updated"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academics/homework/${id}`);
    },
    onSuccess: () => {
      toast.success("Homework deleted");
      if (detailId) setDetailId(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/academics/homework/${id}/publish`);
    },
    onSuccess: () => {
      toast.success("Homework published — students notified");
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const completionsMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any[] }) => {
      const response = await api.patch(`/academics/homework/${id}/completions`, { updates });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success("Completion status updated");
      setDrafts({});
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const startEdit = (hw: HomeworkRow) => {
    setEditing(hw);
    setForm({
      title: hw.title,
      description: hw.description || "",
      classId: hw.classId,
      sectionId: hw.sectionId || "",
      subjectId: hw.subjectId || "",
      academicYearId: "",
      homeworkDate: (hw.homeworkDate || "").slice(0, 10),
      dueDate: (hw.dueDate || "").slice(0, 10),
      priority: hw.priority,
      status: hw.status,
      attachments: Array.isArray(hw.attachments) ? (hw.attachments as string[]).join("\n") : "",
    });
    setShowForm(true);
  };

  const detail = completionsQuery.data;
  const detailRows = detail?.students || [];

  const saveRow = (studentId: string, fallback: CompletionRow["submission"]) => {
    if (!detailId) return;
    const d = drafts[studentId] || { status: fallback.status, teacherRemark: fallback.teacherRemark || "" };
    completionsMutation.mutate({
      id: detailId,
      updates: [{ studentId, status: d.status, teacherRemark: d.teacherRemark || undefined }],
    });
  };

  const markAll = (to: string) => {
    if (!detailId) return;
    const updates = detailRows.map((r) => ({ studentId: r.student.id, status: to }));
    completionsMutation.mutate({ id: detailId, updates });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Assigned students" value={String(totals.assigned)} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
        <StatCard title="Completed" value={String(totals.completed)} icon={<CheckCircle2 className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
        <StatCard title="Pending" value={String(totals.pending)} icon={<Clock className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
        <StatCard title="Overdue" value={String(totals.overdue)} icon={<AlertTriangle className="h-5 w-5" />} iconBg="bg-red-50 text-red-600" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="ps-9"
              placeholder="Search homework…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}>
              <option value="">All classes</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
              <option value="">All sections</option>
              {sectionsOf(classId).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
              Overdue only
            </label>
            {canManage && (
              <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(!showForm); }}>
                <Plus className="ms-1 h-4 w-4" /> New homework
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {showForm && canManage && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="text-base">
              <ClipboardList className="ms-1 inline h-4 w-4" />
              {editing ? `Edit homework — ${editing.title}` : "Assign homework"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (editing) updateMutation.mutate();
                else createMutation.mutate();
              }}
            >
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 5 exercises" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">Instructions</label>
                <textarea
                  className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What should students do?"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Class *</label>
                <Select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: "" })} disabled={!!editing}>
                  <option value="">Select class</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Section</label>
                <Select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })} disabled={!form.classId}>
                  <option value="">Whole class</option>
                  {sectionsOf(form.classId).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
                <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                  <option value="">General</option>
                  {subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assigned date</label>
                <Input type="date" value={form.homeworkDate} onChange={(e) => setForm({ ...form, homeworkDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Due date *</label>
                <Input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </div>
              {years.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Academic year</label>
                  <Select value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}>
                    <option value="">Default</option>
                    {years.map((y: any) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">Attachment links (one per line, optional)</label>
                <textarea
                  className="min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                  value={form.attachments}
                  onChange={(e) => setForm({ ...form, attachments: e.target.value })}
                  placeholder="https://…/worksheet.pdf"
                />
              </div>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="ms-1 h-4 w-4 animate-spin" />}
                  {editing ? "Save changes" : "Assign homework"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homework ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {homeworkQuery.isLoading ? (
            <LoadingState />
          ) : homeworkQuery.isError ? (
            <ErrorState message="Failed to load homework" onRetry={() => homeworkQuery.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState title="No homework found" description="Assign homework to a class to get started." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Class / Subject</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((hw) => {
                  const pct = hw.stats.total ? Math.round((hw.stats.completed / hw.stats.total) * 100) : 0;
                  const dueSoon = new Date(hw.dueDate).getTime() - Date.now() < 2 * 86400_000;
                  return (
                    <TableRow key={hw.id}>
                      <TableCell>
                        <div className="font-medium">{hw.title}</div>
                        <div className="text-xs text-slate-500">
                          {hw.teacher ? `${hw.teacher.firstName} ${hw.teacher.lastName} · ` : ""}
                          Assigned {new Date(hw.homeworkDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {hw.class?.name}{hw.section ? `-${hw.section.name}` : ""} · {hw.subject?.name || "General"}
                      </TableCell>
                      <TableCell>
                        <span className={dueSoon && hw.stats.pending > 0 ? "font-semibold text-red-600" : "text-slate-600"}>
                          {new Date(hw.dueDate).toLocaleDateString()}
                        </span>{" "}
                        <Badge variant={priorityVariant[hw.priority] || "default"}>{hw.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[hw.status] || "default"}>{hw.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-32">
                          <div className="text-xs font-semibold text-slate-700">
                            {hw.stats.completed}/{hw.stats.total} completed · {pct}%
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                          </div>
                          {hw.stats.overdue > 0 && (
                            <div className="mt-0.5 text-xs text-red-600">{hw.stats.overdue} overdue</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="View & track" onClick={() => { setDetailId(hw.id); setDrafts({}); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canManage && (
                            <>
                              {hw.status === "DRAFT" && (
                                <Button variant="ghost" size="icon" title="Publish" onClick={() => publishMutation.mutate(hw.id)}>
                                  <Send className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => startEdit(hw)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (window.confirm(`Delete "${hw.title}"? This also removes all completion records.`)) {
                                    deleteMutation.mutate(hw.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detailId && (
        <Card className="border-green-200">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                Completion — {detail?.homework.title || "…"}
                {detail && (
                  <span className="ms-2 text-sm font-normal text-slate-500">
                    {detail.stats.completed}/{detail.stats.total} completed
                    {detail.stats.overdue > 0 && ` · ${detail.stats.overdue} overdue`}
                  </span>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {canManage && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => markAll("COMPLETED")} disabled={completionsMutation.isPending}>
                      Mark all completed
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => markAll("PENDING")} disabled={completionsMutation.isPending}>
                      Reset to pending
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => setDetailId(null)}>Close</Button>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="ps-9"
                  placeholder="Search student…"
                  value={completionSearch}
                  onChange={(e) => setCompletionSearch(e.target.value)}
                />
              </div>
              <Select value={completionFilter} onChange={(e) => setCompletionFilter(e.target.value)} className="sm:w-48">
                <option value="">All students</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="NOT_SUBMITTED">Not submitted</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {completionsQuery.isLoading ? (
              <LoadingState />
            ) : completionsQuery.isError ? (
              <ErrorState message="Failed to load completion status" onRetry={() => completionsQuery.refetch()} />
            ) : detailRows.length === 0 ? (
              <EmptyState title="No students in scope" description="No active students match this homework's class/section." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    {canManage && <TableHead>Remark</TableHead>}
                    {canManage && <TableHead className="text-end">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map(({ student, submission }) => {
                    const d = drafts[student.id] || { status: submission.status, teacherRemark: submission.teacherRemark || "" };
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="font-medium">{student.firstName} {student.lastName}</div>
                          <div className="text-xs text-slate-500">
                            {student.admissionNumber}{student.rollNumber ? ` · Roll ${student.rollNumber}` : ""}{student.section ? ` · Sec ${student.section.name}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManage ? (
                            <Select
                              value={d.status}
                              onChange={(e) => setDrafts((p) => ({ ...p, [student.id]: { ...d, status: e.target.value } }))}
                              className="w-40"
                            >
                              <option value="PENDING">Pending</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="NOT_SUBMITTED">Not submitted</option>
                            </Select>
                          ) : (
                            completionBadge(submission.status)
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <Input
                              placeholder="Optional remark…"
                              value={d.teacherRemark}
                              onChange={(e) => setDrafts((p) => ({ ...p, [student.id]: { ...d, teacherRemark: e.target.value } }))}
                              className="w-44"
                            />
                          </TableCell>
                        )}
                        {canManage && (
                          <TableCell className="text-end">
                            <Button size="sm" onClick={() => saveRow(student.id, submission)} disabled={completionsMutation.isPending}>
                              Save
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
