"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, Send, CheckCircle2, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, getErrorMessage } from "@/lib/api";

const statusBadge: Record<string, "secondary" | "default" | "success" | "warning" | "danger"> = {
  NOT_ENTERED: "secondary",
  DRAFT: "warning",
  SUBMITTED: "default",
  APPROVED: "success",
  REJECTED: "danger",
};

export function MarksEntry({
  examId,
  canReview,
  locked,
}: {
  examId: string;
  canReview: boolean;
  locked: boolean;
}) {
  const queryClient = useQueryClient();
  const [examSubjectId, setExamSubjectId] = useState("");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<Record<string, { marks: string; absent: boolean; exempt: boolean }>>({});

  const examQuery = useQuery({
    queryKey: ["exams", examId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}`);
      return res.data.data;
    },
  });

  const rosterQuery = useQuery({
    queryKey: ["exam-roster", examId, examSubjectId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/roster`, { params: { examSubjectId } });
      return res.data.data;
    },
    enabled: !!examSubjectId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["exam-roster", examId] });
    queryClient.invalidateQueries({ queryKey: ["exams"] });
  };

  const subjects: any[] = examQuery.data?.subjects || [];
  const active = subjects.find((s: any) => s.id === examSubjectId);
  const rows: any[] = useMemo(() => {
    const list = rosterQuery.data?.students || [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((r: any) =>
      `${r.student.firstName} ${r.student.lastName} ${r.student.admissionNumber}`.toLowerCase().includes(q)
    );
  }, [rosterQuery.data, search]);

  const entryOf = (row: any) => {
    const e = entries[row.student.id];
    if (e) return e;
    return {
      marks: row.mark?.marksObtained != null ? String(row.mark.marksObtained) : "",
      absent: !!row.mark?.isAbsent,
      exempt: !!row.mark?.isExempt,
    };
  };

  const setEntry = (id: string, patch: Partial<{ marks: string; absent: boolean; exempt: boolean }>) =>
    setEntries((p) => ({ ...p, [id]: { ...entryOf({ student: { id }, mark: null }), ...patch } }));

  const buildPayload = () =>
    rows
      .map((r: any) => {
        const e = entryOf(r);
        const changed =
          e.marks !== (r.mark?.marksObtained != null ? String(r.mark.marksObtained) : "") ||
          e.absent !== !!r.mark?.isAbsent ||
          e.exempt !== !!r.mark?.isExempt;
        if (!changed) return null;
        return {
          studentId: r.student.id,
          marksObtained: e.absent || e.exempt || e.marks === "" ? null : Number(e.marks),
          isAbsent: e.absent,
          isExempt: e.exempt,
        };
      })
      .filter(Boolean);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const marks = buildPayload();
      if (!marks.length) throw new Error("No changes to save");
      await api.post(`/exams/${examId}/marks`, { examSubjectId, marks });
    },
    onSuccess: () => {
      toast.success("Marks saved as draft");
      setEntries({});
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/exams/${examId}/marks/submit`, { examSubjectId });
      return res.data.data;
    },
    onSuccess: (res) => {
      toast.success(`Submitted ${res.submitted} marks for review`);
      setEntries({});
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const reviewMutation = useMutation({
    mutationFn: async (payload: { approved?: string[]; rejected?: { studentId: string; note?: string }[] }) => {
      await api.post(`/exams/${examId}/marks/review`, { examSubjectId, ...payload });
    },
    onSuccess: () => {
      toast.success("Review saved");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const progress = rosterQuery.data?.progress;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Marks entry
            {progress && (
              <span className="ms-2 text-sm font-normal text-slate-500">
                {progress.entered}/{progress.total} entered
              </span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Select value={examSubjectId} onChange={(e) => { setExamSubjectId(e.target.value); setEntries({}); }} className="w-56">
              <option value="">Select subject…</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.subject?.name} (max {s.maxMarks})</option>
              ))}
            </Select>
          </div>
        </div>
        {progress && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(progress.byStatus).map(([k, v]) => (
              <Badge key={k} variant={statusBadge[k] || "secondary"}>{k.replace(/_/g, " ")}: {v as number}</Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!examSubjectId ? (
          <EmptyState title="Select a subject" description="Choose an exam subject to load the student roster." />
        ) : rosterQuery.isLoading ? (
          <LoadingState />
        ) : rosterQuery.isError ? (
          <ErrorState message="Failed to load roster" onRetry={() => rosterQuery.refetch()} />
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="ps-9" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {!locked && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save draft
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                    <Send className="h-3.5 w-3.5" /> Submit for review
                  </Button>
                </div>
              )}
            </div>
            {locked && <p className="mb-3 rounded-lg bg-slate-100 p-2 text-xs text-slate-600">Results are published — marks are locked. Corrections require republish rights and are audited.</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Marks{active ? ` / ${active.maxMarks}` : ""}</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Exempt</TableHead>
                  <TableHead>Status</TableHead>
                  {canReview && <TableHead className="text-end">Review</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => {
                  const e = entryOf(r);
                  const st = r.mark?.status || "NOT_ENTERED";
                  const rowLocked = locked || st === "SUBMITTED" || st === "APPROVED";
                  return (
                    <TableRow key={r.student.id}>
                      <TableCell>
                        <div className="font-medium">{r.student.firstName} {r.student.lastName}</div>
                        <div className="text-xs text-slate-500">{r.student.admissionNumber}{r.student.section ? ` · ${r.student.section.name}` : ""}</div>
                        {r.mark?.reviewNote && <div className="mt-0.5 text-xs text-red-600">Reviewer: {r.mark.reviewNote}</div>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number" min={0} max={active?.maxMarks ?? 1000} className="mx-auto w-24 text-center"
                          value={e.marks} disabled={rowLocked || e.absent || e.exempt}
                          onChange={(ev) => setEntry(r.student.id, { marks: ev.target.value })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input type="checkbox" checked={e.absent} disabled={rowLocked} onChange={(ev) => setEntry(r.student.id, { absent: ev.target.checked, exempt: false })} />
                      </TableCell>
                      <TableCell className="text-center">
                        <input type="checkbox" checked={e.exempt} disabled={rowLocked} onChange={(ev) => setEntry(r.student.id, { exempt: ev.target.checked, absent: false })} />
                      </TableCell>
                      <TableCell><Badge variant={statusBadge[st] || "secondary"}>{st.replace(/_/g, " ")}</Badge></TableCell>
                      {canReview && (
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm" variant="outline" disabled={st !== "SUBMITTED"}
                              onClick={() => reviewMutation.mutate({ approved: [r.student.id] })}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm" variant="outline" disabled={st !== "SUBMITTED"}
                              onClick={() => {
                                const note = window.prompt("Rejection note for the teacher:", r.mark?.reviewNote || "");
                                if (note !== null) reviewMutation.mutate({ rejected: [{ studentId: r.student.id, note }] });
                              }}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
