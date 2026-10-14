"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, getErrorMessage } from "@/lib/api";

const EXAM_TYPES = ["Unit Test", "Monthly Test", "Mid-Term", "Final", "Practical", "Mock Exam"];

interface SubjectRow {
  subjectId: string;
  maxMarks: string;
  passMarks: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
}

const blankSubject = (): SubjectRow => ({
  subjectId: "",
  maxMarks: "100",
  passMarks: "40",
  date: "",
  startTime: "",
  endTime: "",
  room: "",
});

export function ExamForm({
  schoolId,
  editing,
  onDone,
}: {
  schoolId: string;
  editing?: any | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name || "");
  const [type, setType] = useState(editing?.type || "Mid-Term");
  const [startDate, setStartDate] = useState((editing?.startDate || "").slice(0, 10));
  const [endDate, setEndDate] = useState((editing?.endDate || "").slice(0, 10));
  const [durationMin, setDurationMin] = useState(editing?.durationMin != null ? String(editing.durationMin) : "");
  const [instructions, setInstructions] = useState(editing?.instructions || "");
  const [academicYearId, setAcademicYearId] = useState(editing?.academicYearId || "");
  const [rankEnabled, setRankEnabled] = useState(!!editing?.gradingPolicy?.rankEnabled);
  const [classIds, setClassIds] = useState<string[]>(
    editing?.classes?.map((c: any) => c.classId) || []
  );
  const [subjects, setSubjects] = useState<SubjectRow[]>(
    editing?.subjects?.length
      ? editing.subjects.map((s: any) => ({
          subjectId: s.subjectId,
          maxMarks: String(s.maxMarks),
          passMarks: String(s.passMarks),
          date: (s.date || "").slice(0, 10),
          startTime: s.startTime || "",
          endTime: s.endTime || "",
          room: s.room || "",
        }))
      : [blankSubject()]
  );

  const classesQuery = useQuery({
    queryKey: ["school-classes", schoolId],
    queryFn: async () => {
      const res = await api.get(`/schools/${schoolId}/classes`);
      return res.data.data || [];
    },
    enabled: !!schoolId,
  });
  const subjectsQuery = useQuery({
    queryKey: ["homework-subjects", schoolId],
    queryFn: async () => {
      const res = await api.get("/subjects", { params: { limit: 100 } });
      return res.data.data || [];
    },
    enabled: !!schoolId,
  });
  const yearsQuery = useQuery({
    queryKey: ["homework-years", schoolId],
    queryFn: async () => {
      try {
        const res = await api.get("/fees/academic-years");
        return res.data.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!schoolId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["exams"] });
    queryClient.invalidateQueries({ queryKey: ["exams-dashboard"] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name,
        type,
        startDate,
        endDate,
        academicYearId: academicYearId || undefined,
        durationMin: durationMin ? Number(durationMin) : undefined,
        instructions: instructions || undefined,
        gradingPolicy: { rankEnabled },
        classes: classIds.map((classId) => ({ classId })),
        subjects: subjects
          .filter((s) => s.subjectId)
          .map((s) => ({
            subjectId: s.subjectId,
            maxMarks: Number(s.maxMarks) || 100,
            passMarks: Number(s.passMarks) || 0,
            date: s.date || undefined,
            startTime: s.startTime || undefined,
            endTime: s.endTime || undefined,
            room: s.room || undefined,
          })),
      };
      if (editing) await api.put(`/exams/${editing.id}`, payload);
      else await api.post("/exams", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Exam updated" : "Exam created as draft");
      invalidate();
      onDone();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const toggleClass = (id: string) =>
    setClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  return (
    <Card className="border-primary-200 bg-primary-50/30">
      <CardHeader>
        <CardTitle className="text-base">{editing ? `Edit — ${editing.name}` : "Create examination"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!classIds.length) {
              toast.error("Select at least one class");
              return;
            }
            if (!subjects.some((s) => s.subjectId)) {
              toast.error("Add at least one subject");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Exam name *</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. First Term Examination" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exam type *</label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start date *</label>
            <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">End date *</label>
            <Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Duration (minutes)</label>
            <Input type="number" min={1} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="180" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Academic year</label>
            <Select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              <option value="">Default</option>
              {(yearsQuery.data || []).map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={rankEnabled} onChange={(e) => setRankEnabled(e.target.checked)} />
              Enable ranks on report cards
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Instructions</label>
            <textarea className="min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Admit card, stationery, reporting time…" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Classes * (whole class unless sections are assigned later)</label>
            <div className="flex flex-wrap gap-2">
              {(classesQuery.data || []).map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleClass(c.id)}
                  className={`rounded-full px-3.5 py-2 text-xs font-bold ${classIds.includes(c.id) ? "bg-primary-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Subjects & timetable *</label>
              <Button type="button" variant="outline" size="sm" onClick={() => setSubjects((p) => [...p, blankSubject()])}>
                <Plus className="h-3.5 w-3.5" /> Add subject
              </Button>
            </div>
            <div className="space-y-2">
              {subjects.map((s, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-200 sm:grid-cols-7">
                  <Select className="col-span-2 sm:col-span-2" value={s.subjectId} onChange={(e) => setSubjects((p) => p.map((r, j) => (j === i ? { ...r, subjectId: e.target.value } : r)))}>
                    <option value="">Subject…</option>
                    {(subjectsQuery.data || []).map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                  </Select>
                  <Input type="number" min={1} placeholder="Max" value={s.maxMarks} onChange={(e) => setSubjects((p) => p.map((r, j) => (j === i ? { ...r, maxMarks: e.target.value } : r)))} />
                  <Input type="number" min={0} placeholder="Pass" value={s.passMarks} onChange={(e) => setSubjects((p) => p.map((r, j) => (j === i ? { ...r, passMarks: e.target.value } : r)))} />
                  <Input type="date" value={s.date} onChange={(e) => setSubjects((p) => p.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))} />
                  <Input placeholder="09:00" value={s.startTime} onChange={(e) => setSubjects((p) => p.map((r, j) => (j === i ? { ...r, startTime: e.target.value } : r)))} />
                  <div className="col-span-2 flex gap-2 sm:col-span-1">
                    <Input placeholder="Room" value={s.room} onChange={(e) => setSubjects((p) => p.map((r, j) => (j === i ? { ...r, room: e.target.value } : r)))} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setSubjects((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="ms-1 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create exam"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
