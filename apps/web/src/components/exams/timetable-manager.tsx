"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Printer, Loader2, CalendarDays, Table as TableIcon } from "lucide-react";
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

export function TimetableManager({ examId, canManage }: { examId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"table" | "calendar">("table");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ subjectId: "", maxMarks: "100", passMarks: "40", date: "", startTime: "", endTime: "", durationMin: "", room: "", invigilatorId: "", instructions: "" });

  const examQuery = useQuery({
    queryKey: ["exams", examId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}`);
      return res.data.data;
    },
  });

  const subjectsQuery = useQuery({
    queryKey: ["exam-subject-options"],
    queryFn: async () => {
      const res = await api.get("/subjects", { params: { limit: 100 } });
      return res.data.data || [];
    },
    enabled: canManage && showForm && !editing,
  });

  const teachersQuery = useQuery({
    queryKey: ["exam-invigilators"],
    queryFn: async () => {
      const res = await api.get("/teachers", { params: { limit: 100 } });
      return res.data.data || [];
    },
    enabled: canManage && showForm,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["exams"] });
    queryClient.invalidateQueries({ queryKey: ["exams", examId] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        maxMarks: Number(form.maxMarks) || 100,
        passMarks: Number(form.passMarks) || 0,
        date: form.date || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        durationMin: form.durationMin ? Number(form.durationMin) : undefined,
        room: form.room || undefined,
        invigilatorId: form.invigilatorId || undefined,
        instructions: form.instructions || undefined,
      };
      if (editing) await api.put(`/exams/${examId}/subjects/${editing.id}`, payload);
      else await api.post(`/exams/${examId}/subjects`, { subjectId: form.subjectId, ...payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Timetable entry updated" : "Timetable entry added");
      setShowForm(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (subjectId: string) => {
      await api.delete(`/exams/${examId}/subjects/${subjectId}`);
    },
    onSuccess: () => {
      toast.success("Timetable entry removed");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const exam = examQuery.data;
  const entries: any[] = useMemo(
    () => [...(exam?.subjects || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))),
    [exam]
  );
  const byDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of entries) {
      const key = e.date ? new Date(e.date).toLocaleDateString() : "Unscheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  const startEdit = (e: any) => {
    setEditing(e);
    setForm({
      subjectId: e.subjectId,
      maxMarks: String(e.maxMarks),
      passMarks: String(e.passMarks),
      date: (e.date || "").slice(0, 10),
      startTime: e.startTime || "",
      endTime: e.endTime || "",
      durationMin: e.durationMin != null ? String(e.durationMin) : "",
      room: e.room || "",
      invigilatorId: e.invigilatorId || "",
      instructions: e.instructions || "",
    });
    setShowForm(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Exam timetable ({entries.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setView(view === "table" ? "calendar" : "table")}>
              {view === "table" ? <CalendarDays className="h-3.5 w-3.5" /> : <TableIcon className="h-3.5 w-3.5" />}
              {view === "table" ? "Calendar view" : "Table view"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => { setEditing(null); setForm({ subjectId: "", maxMarks: "100", passMarks: "40", date: "", startTime: "", endTime: "", durationMin: "", room: "", invigilatorId: "", instructions: "" }); setShowForm(!showForm); }}>
                <Plus className="h-3.5 w-3.5" /> Add entry
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {examQuery.isLoading ? (
          <LoadingState />
        ) : examQuery.isError ? (
          <ErrorState message="Failed to load timetable" onRetry={() => examQuery.refetch()} />
        ) : (
          <>
            {showForm && canManage && (
              <form
                className="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate();
                }}
              >
                {!editing && (
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Subject *</label>
                    <Select required value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                      <option value="">Select subject…</option>
                      {(subjectsQuery.data || []).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Start (HH:MM)</label>
                  <Input placeholder="09:00" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">End (HH:MM)</label>
                  <Input placeholder="12:00" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Room / hall</label>
                  <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Hall A" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Invigilator</label>
                  <Select value={form.invigilatorId} onChange={(e) => setForm({ ...form, invigilatorId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {(teachersQuery.data || []).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Duration (min)</label>
                  <Input type="number" min={1} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />
                </div>
                <div className="flex gap-4 text-xs text-slate-600">
                  <span>Max <Input type="number" className="mt-1 w-24" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} /></span>
                  <span>Pass <Input type="number" className="mt-1 w-24" value={form.passMarks} onChange={(e) => setForm({ ...form, passMarks: e.target.value })} /></span>
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
                  <Input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Seating, materials…" />
                </div>
                <div className="flex gap-2 sm:col-span-3">
                  <Button type="submit" size="sm" disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {editing ? "Save" : "Add"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
                </div>
              </form>
            )}
            {entries.length === 0 ? (
              <EmptyState title="No timetable entries" description="Add subject schedules for this exam." />
            ) : view === "table" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Invigilator</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    {canManage && <TableHead className="text-end">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.subject?.name}</TableCell>
                      <TableCell>{e.date ? new Date(e.date).toLocaleDateString() : <Badge variant="secondary">TBA</Badge>}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {e.startTime || "—"}{e.endTime ? `–${e.endTime}` : ""}{e.durationMin ? ` (${e.durationMin}m)` : ""}
                      </TableCell>
                      <TableCell>{e.room || "—"}</TableCell>
                      <TableCell className="text-sm">{e.invigilator ? `${e.invigilator.firstName} ${e.invigilator.lastName}` : "—"}</TableCell>
                      <TableCell className="text-center text-sm">{e.maxMarks} / pass {e.passMarks}</TableCell>
                      {canManage && (
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Remove ${e.subject?.name} from this exam?`)) deleteMutation.mutate(e.id); }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="space-y-4">
                {byDate.map(([day, list]) => (
                  <div key={day} className="rounded-xl border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">{day}</div>
                    <div className="divide-y divide-slate-100">
                      {list.map((e: any) => (
                        <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                          <span className="font-mono text-xs font-bold text-primary-700">{e.startTime || "—"}{e.endTime ? `–${e.endTime}` : ""}</span>
                          <span className="font-medium text-slate-800">{e.subject?.name}</span>
                          {e.room && <Badge variant="secondary">{e.room}</Badge>}
                          {e.invigilator && <span className="text-xs text-slate-500">{e.invigilator.firstName} {e.invigilator.lastName}</span>}
                          {canManage && (
                            <span className="ms-auto flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Remove ${e.subject?.name}?`)) deleteMutation.mutate(e.id); }}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
