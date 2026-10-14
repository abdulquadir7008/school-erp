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
  Copy,
  Archive,
  Lock,
  RotateCcw,
  Star,
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

interface AssignmentStats {
  total: number;
  submitted: number;
  pending: number;
  late: number;
  reviewed: number;
  graded: number;
  returnedForRevision: number;
  averageMarks: number | null;
}

interface AssignmentRow {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  classId: string;
  sectionId?: string | null;
  subjectId?: string | null;
  type: string;
  assignedDate: string;
  dueDate: string;
  lateSubmissionDate?: string | null;
  allowLateSubmission: boolean;
  totalMarks?: number | null;
  passingMarks?: number | null;
  gradingCriteria?: string | null;
  referenceMaterials?: string[] | null;
  attachments?: string[] | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  teacher?: { id: string; firstName: string; lastName: string } | null;
  stats: AssignmentStats;
}

interface SubmissionRow {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber?: number | null;
    section?: { id: string; name: string } | null;
  };
  submission: {
    status: string;
    submittedAt?: string | null;
    isLate?: boolean;
    submissionText?: string | null;
    marksObtained?: number | null;
    feedback?: string | null;
    gradesPublished?: boolean;
    version?: number;
  };
}

const emptyForm = {
  title: "",
  description: "",
  instructions: "",
  classId: "",
  sectionId: "",
  subjectId: "",
  academicYearId: "",
  type: "INDIVIDUAL",
  assignedDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  lateSubmissionDate: "",
  allowLateSubmission: false,
  totalMarks: "",
  passingMarks: "",
  gradingCriteria: "",
  referenceMaterials: "",
  attachments: "",
  status: "PUBLISHED",
};

const statusVariant: Record<string, "success" | "warning" | "secondary" | "default"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  CLOSED: "secondary",
  ARCHIVED: "secondary",
};

function submissionBadge(status: string) {
  if (status === "GRADED") return <Badge variant="success">Graded</Badge>;
  if (status === "SUBMITTED" || status === "RESUBMITTED") return <Badge variant="default">Submitted</Badge>;
  if (status === "LATE_SUBMITTED") return <Badge variant="warning">Late</Badge>;
  if (status === "UNDER_REVIEW") return <Badge variant="default">Under review</Badge>;
  if (status === "RETURNED_FOR_REVISION") return <Badge variant="danger">Revision</Badge>;
  return <Badge variant="warning">Not submitted</Badge>;
}

export function AssignmentsManager({ schoolId }: { schoolId: string }) {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission("homework.create");

  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionFilter, setSubmissionFilter] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { marks: string; feedback: string; status: string }>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
    queryClient.invalidateQueries({ queryKey: ["assignment-submissions"] });
  };

  const assignmentsQuery = useQuery({
    queryKey: ["assignments", schoolId, search, classId, sectionId, subjectId, type, status, overdueOnly],
    queryFn: async () => {
      const response = await api.get("/academics/assignments", {
        params: {
          ...(classId ? { classId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(subjectId ? { subjectId } : {}),
          ...(type ? { type } : {}),
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(overdueOnly ? { overdue: "true" } : {}),
        },
      });
      return (response.data.data || []) as AssignmentRow[];
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

  const submissionsQuery = useQuery({
    queryKey: ["assignment-submissions", detailId, submissionSearch, submissionFilter],
    queryFn: async () => {
      const response = await api.get(`/academics/assignments/${detailId}/submissions`, {
        params: {
          ...(submissionSearch ? { search: submissionSearch } : {}),
          ...(submissionFilter ? { status: submissionFilter } : {}),
        },
      });
      return response.data.data as { assignment: AssignmentRow; students: SubmissionRow[]; stats: AssignmentStats };
    },
    enabled: !!detailId,
  });

  const items = assignmentsQuery.data || [];
  const classes: any[] = classesQuery.data || [];
  const subjects: any[] = subjectsQuery.data || [];
  const years: any[] = yearsQuery.data || [];
  const sectionsOf = (cid: string) => classes.find((c: any) => c.id === cid)?.sections || [];

  const totals = useMemo(() => {
    return items.reduce(
      (acc, a) => ({
        assigned: acc.assigned + a.stats.total,
        submitted: acc.submitted + a.stats.submitted,
        pending: acc.pending + a.stats.pending,
        late: acc.late + a.stats.late,
        graded: acc.graded + a.stats.graded,
      }),
      { assigned: 0, submitted: 0, pending: 0, late: 0, graded: 0 }
    );
  }, [items]);

  const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);
  const joinLines = (v: string[] | null | undefined) => (Array.isArray(v) ? v.join("\n") : "");

  const payload = () => ({
    title: form.title,
    description: form.description || undefined,
    instructions: form.instructions || undefined,
    classId: form.classId,
    sectionId: form.sectionId || undefined,
    subjectId: form.subjectId || undefined,
    academicYearId: form.academicYearId || undefined,
    type: form.type,
    assignedDate: form.assignedDate || undefined,
    dueDate: form.dueDate,
    lateSubmissionDate: form.lateSubmissionDate || undefined,
    allowLateSubmission: form.allowLateSubmission,
    totalMarks: form.totalMarks ? Number(form.totalMarks) : undefined,
    passingMarks: form.passingMarks ? Number(form.passingMarks) : undefined,
    gradingCriteria: form.gradingCriteria || undefined,
    referenceMaterials: form.referenceMaterials ? lines(form.referenceMaterials) : undefined,
    attachments: form.attachments ? lines(form.attachments) : undefined,
    status: form.status,
  });

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
      await api.post("/academics/assignments", payload());
    },
    ...mutateOptions("Assignment created"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await api.put(`/academics/assignments/${editing.id}`, {
        ...payload(),
        classId: undefined,
        sectionId: form.sectionId || null,
        subjectId: form.subjectId || null,
        academicYearId: form.academicYearId || null,
        totalMarks: form.totalMarks ? Number(form.totalMarks) : null,
        passingMarks: form.passingMarks ? Number(form.passingMarks) : null,
        referenceMaterials: form.referenceMaterials ? lines(form.referenceMaterials) : [],
        attachments: form.attachments ? lines(form.attachments) : [],
      });
    },
    ...mutateOptions("Assignment updated"),
  });

  const makeActionMutation = (msg: string) =>
    useMutation({
      mutationFn: async ({ url, method }: { url: string; method: "post" | "delete" }) => {
        if (method === "delete") await api.delete(url);
        else await api.post(url);
      },
      onSuccess: () => {
        toast.success(msg);
        invalidate();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });

  const deleteMutation = makeActionMutation("Assignment deleted");
  const publishMutation = makeActionMutation("Assignment published — students notified");
  const closeMutation = makeActionMutation("Assignment closed");
  const reopenMutation = makeActionMutation("Assignment reopened");
  const archiveMutation = makeActionMutation("Assignment archived");
  const duplicateMutation = makeActionMutation("Duplicated as draft");
  const publishGradesMutation = makeActionMutation("Grades published — students notified");

  const postTo = (
    m: { mutate: (v: { url: string; method: "post" | "delete" }) => void },
    id: string,
    path = "",
    method: "post" | "delete" = "post"
  ) => m.mutate({ url: `/academics/assignments/${id}${path ? `/${path}` : ""}`, method });

  const gradeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any[] }) => {
      const response = await api.patch(`/academics/assignments/${id}/grade`, { updates });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success("Grading saved");
      setDrafts({});
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const startEdit = (a: AssignmentRow) => {
    setEditing(a);
    setForm({
      title: a.title,
      description: a.description || "",
      instructions: a.instructions || "",
      classId: a.classId,
      sectionId: a.sectionId || "",
      subjectId: a.subjectId || "",
      academicYearId: "",
      type: a.type,
      assignedDate: (a.assignedDate || "").slice(0, 10),
      dueDate: (a.dueDate || "").slice(0, 10),
      lateSubmissionDate: (a.lateSubmissionDate || "").slice(0, 10),
      allowLateSubmission: a.allowLateSubmission,
      totalMarks: a.totalMarks != null ? String(a.totalMarks) : "",
      passingMarks: a.passingMarks != null ? String(a.passingMarks) : "",
      gradingCriteria: a.gradingCriteria || "",
      referenceMaterials: joinLines(a.referenceMaterials),
      attachments: joinLines(a.attachments),
      status: a.status,
    });
    setShowForm(true);
  };

  const detail = submissionsQuery.data;
  const detailRows = detail?.students || [];
  const maxMarks = detail?.assignment.totalMarks ?? null;

  const saveRow = (studentId: string, fallback: SubmissionRow["submission"]) => {
    if (!detailId) return;
    const d = drafts[studentId] || {
      marks: fallback.marksObtained != null ? String(fallback.marksObtained) : "",
      feedback: fallback.feedback || "",
      status: fallback.status,
    };
    gradeMutation.mutate({
      id: detailId,
      updates: [
        {
          studentId,
          marksObtained: d.marks === "" ? undefined : Number(d.marks),
          feedback: d.feedback || undefined,
          status: ["UNDER_REVIEW", "GRADED", "RETURNED_FOR_REVISION", "NOT_SUBMITTED"].includes(d.status)
            ? d.status
            : undefined,
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Assigned" value={String(totals.assigned)} icon={<CheckCircle2 className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
        <StatCard title="Submitted" value={String(totals.submitted)} icon={<Send className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
        <StatCard title="Pending" value={String(totals.pending)} icon={<Clock className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
        <StatCard title="Late" value={String(totals.late)} icon={<AlertTriangle className="h-5 w-5" />} iconBg="bg-red-50 text-red-600" />
        <StatCard title="Graded" value={String(totals.graded)} icon={<Star className="h-5 w-5" />} iconBg="bg-purple-50 text-purple-600" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="ps-9" placeholder="Search assignments…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}>
              <option value="">All classes</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
              <option value="">All sections</option>
              {sectionsOf(classId).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="GROUP">Group</option>
              <option value="PROJECT">Project</option>
              <option value="PRACTICAL">Practical</option>
              <option value="RESEARCH">Research</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CLOSED">Closed</option>
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
                <Plus className="ms-1 h-4 w-4" /> New assignment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {showForm && canManage && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="text-base">{editing ? `Edit — ${editing.title}` : "Create assignment"}</CardTitle>
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
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Solar system project" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="GROUP">Group</option>
                  <option value="PROJECT">Project</option>
                  <option value="PRACTICAL">Practical</option>
                  <option value="RESEARCH">Research</option>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea className="min-h-16 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">Instructions for students</label>
                <textarea className="min-h-16 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Steps, format, submission rules…" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Class *</label>
                <Select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: "" })} disabled={!!editing}>
                  <option value="">Select class</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Section</label>
                <Select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })} disabled={!form.classId}>
                  <option value="">Whole class</option>
                  {sectionsOf(form.classId).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
                <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                  <option value="">General</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assigned date</label>
                <Input type="date" value={form.assignedDate} onChange={(e) => setForm({ ...form, assignedDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Deadline *</label>
                <Input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Late deadline (optional)</label>
                <Input type="date" value={form.lateSubmissionDate} onChange={(e) => setForm({ ...form, lateSubmissionDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Max marks</label>
                <Input type="number" min={1} value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} placeholder="100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Passing marks</label>
                <Input type="number" min={0} value={form.passingMarks} onChange={(e) => setForm({ ...form, passingMarks: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">Grading criteria / rubric</label>
                <textarea className="min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={form.gradingCriteria} onChange={(e) => setForm({ ...form, gradingCriteria: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Reference links (one per line)</label>
                <textarea className="min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs" value={form.referenceMaterials} onChange={(e) => setForm({ ...form, referenceMaterials: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Attachment links (one per line)</label>
                <textarea className="min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs" value={form.attachments} onChange={(e) => setForm({ ...form, attachments: e.target.value })} />
              </div>
              <div className="flex items-end gap-4">
                {years.length > 0 && (
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Academic year</label>
                    <Select value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}>
                      <option value="">Default</option>
                      {years.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </Select>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.allowLateSubmission} onChange={(e) => setForm({ ...form, allowLateSubmission: e.target.checked })} />
                  Allow late submission
                </label>
              </div>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="ms-1 h-4 w-4 animate-spin" />}
                  {editing ? "Save changes" : "Create assignment"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignments ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {assignmentsQuery.isLoading ? (
            <LoadingState />
          ) : assignmentsQuery.isError ? (
            <ErrorState message="Failed to load assignments" onRetry={() => assignmentsQuery.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState title="No assignments found" description="Create an assignment to get started." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Class / Subject</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => {
                  const pct = a.stats.total ? Math.round((a.stats.submitted / a.stats.total) * 100) : 0;
                  const gPct = a.stats.total ? Math.round((a.stats.graded / a.stats.total) * 100) : 0;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-slate-500">
                          {a.type}{a.totalMarks != null ? ` · ${a.totalMarks} marks` : ""}
                          {a.stats.averageMarks != null ? ` · avg ${a.stats.averageMarks}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {a.class?.name}{a.section ? `-${a.section.name}` : ""} · {a.subject?.name || "General"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{new Date(a.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant={statusVariant[a.status] || "default"}>{a.status}</Badge></TableCell>
                      <TableCell>
                        <div className="min-w-32">
                          <div className="text-xs font-semibold text-slate-700">
                            {a.stats.submitted}/{a.stats.total} submitted · {pct}%
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {a.stats.graded}/{a.stats.total} graded · {gPct}%
                            {a.stats.late > 0 && <span className="text-red-600"> · {a.stats.late} late</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Submissions & grading" onClick={() => { setDetailId(a.id); setDrafts({}); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canManage && (
                            <>
                              {a.status === "DRAFT" && (
                                <Button variant="ghost" size="icon" title="Publish" onClick={() => postTo(publishMutation, a.id, "publish")}>
                                  <Send className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              {a.status === "PUBLISHED" && (
                                <Button variant="ghost" size="icon" title="Close submissions" onClick={() => postTo(closeMutation, a.id, "close")}>
                                  <Lock className="h-4 w-4 text-amber-600" />
                                </Button>
                              )}
                              {a.status === "CLOSED" && (
                                <Button variant="ghost" size="icon" title="Reopen" onClick={() => postTo(reopenMutation, a.id, "reopen")}>
                                  <RotateCcw className="h-4 w-4 text-blue-600" />
                                </Button>
                              )}
                              {(a.status === "PUBLISHED" || a.status === "CLOSED") && (
                                <Button variant="ghost" size="icon" title="Archive" onClick={() => postTo(archiveMutation, a.id, "archive")}>
                                  <Archive className="h-4 w-4 text-slate-500" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" title="Duplicate" onClick={() => postTo(duplicateMutation, a.id, "duplicate")}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => startEdit(a)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (window.confirm(`Delete "${a.title}"? Submissions and history are removed too.`)) {
                                    postTo(deleteMutation, a.id, "", "delete");
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
                Submissions — {detail?.assignment.title || "…"}
                {detail && (
                  <span className="ms-2 text-sm font-normal text-slate-500">
                    {detail.stats.submitted}/{detail.stats.total} submitted · {detail.stats.graded} graded
                    {detail.stats.averageMarks != null && ` · avg ${detail.stats.averageMarks}`}
                  </span>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Publish grades to all graded students? They will be notified.")) {
                        postTo(publishGradesMutation, detailId, "publish-grades");
                      }
                    }}
                  >
                    Publish grades
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setDetailId(null)}>Close</Button>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="ps-9" placeholder="Search student…" value={submissionSearch} onChange={(e) => setSubmissionSearch(e.target.value)} />
              </div>
              <Select value={submissionFilter} onChange={(e) => setSubmissionFilter(e.target.value)} className="sm:w-52">
                <option value="">All students</option>
                <option value="NOT_SUBMITTED">Not submitted</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="LATE_SUBMITTED">Late</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="RETURNED_FOR_REVISION">Needs revision</option>
                <option value="GRADED">Graded</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {submissionsQuery.isLoading ? (
              <LoadingState />
            ) : submissionsQuery.isError ? (
              <ErrorState message="Failed to load submissions" onRetry={() => submissionsQuery.refetch()} />
            ) : detailRows.length === 0 ? (
              <EmptyState title="No students in scope" description="No active students match this assignment's class/section." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Marks{maxMarks != null ? ` / ${maxMarks}` : ""}</TableHead>
                    {canManage && <TableHead>Feedback</TableHead>}
                    {canManage && <TableHead className="text-end">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map(({ student, submission }) => {
                    const d = drafts[student.id] || {
                      marks: submission.marksObtained != null ? String(submission.marksObtained) : "",
                      feedback: submission.feedback || "",
                      status: submission.status,
                    };
                    const hasWork = (submission.version ?? 0) > 0;
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="font-medium">{student.firstName} {student.lastName}</div>
                          <div className="text-xs text-slate-500">
                            {student.admissionNumber}{student.section ? ` · Sec ${student.section.name}` : ""}
                            {submission.submittedAt ? ` · ${new Date(submission.submittedAt).toLocaleDateString()}` : ""}
                            {submission.isLate ? " · late" : ""}
                            {submission.gradesPublished ? " · published" : ""}
                          </div>
                          {submission.submissionText && (
                            <div className="mt-1 max-w-md truncate text-xs text-slate-600" title={submission.submissionText}>
                              “{submission.submissionText}”
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {canManage ? (
                            <Select
                              value={["UNDER_REVIEW", "GRADED", "RETURNED_FOR_REVISION", "NOT_SUBMITTED"].includes(d.status) ? d.status : "UNDER_REVIEW"}
                              onChange={(e) => setDrafts((p) => ({ ...p, [student.id]: { ...d, status: e.target.value } }))}
                              className="w-40"
                            >
                              <option value="UNDER_REVIEW">Under review</option>
                              <option value="GRADED">Graded</option>
                              <option value="RETURNED_FOR_REVISION">Needs revision</option>
                              <option value="NOT_SUBMITTED">Not submitted</option>
                            </Select>
                          ) : (
                            submissionBadge(submission.status)
                          )}
                        </TableCell>
                        <TableCell>
                          {canManage ? (
                            <Input
                              type="number"
                              min={0}
                              max={maxMarks ?? 1000}
                              className="w-24"
                              disabled={!hasWork}
                              value={d.marks}
                              onChange={(e) => setDrafts((p) => ({ ...p, [student.id]: { ...d, marks: e.target.value } }))}
                            />
                          ) : (
                            <span className="text-sm">{submission.marksObtained ?? "—"}</span>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <Input
                              placeholder="Feedback…"
                              className="w-44"
                              value={d.feedback}
                              onChange={(e) => setDrafts((p) => ({ ...p, [student.id]: { ...d, feedback: e.target.value } }))}
                            />
                          </TableCell>
                        )}
                        {canManage && (
                          <TableCell className="text-end">
                            <Button size="sm" onClick={() => saveRow(student.id, submission)} disabled={gradeMutation.isPending || !hasWork}>
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
