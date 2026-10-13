import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useExams, useTeacherStudents } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, LoadingView, Pill, Screen, SectionTitle, statusTone } from "../../src/components/ui";

export default function TeacherExams() {
  const queryClient = useQueryClient();
  const exams = useExams();
  const [examId, setExamId] = useState<string | null>(null);
  const [examSubjectId, setExamSubjectId] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const students = useTeacherStudents();

  const openExam = async (id: string) => {
    const exam = (exams.data || []).find((e: any) => e.id === id);
    const firstSubject = exam?.subjects?.[0];
    setExamId(id);
    setExamSubjectId(firstSubject?.id || null);
    setBusy(true);
    setMsg(null);
    try {
      const r = await mobileApi.examResults(id);
      setResults(r);
      const preset: Record<string, string> = {};
      for (const s of r.students || []) {
        const subj = s.subjects?.[0];
        if (subj) preset[s.id] = subj.obtained != null ? String(subj.obtained) : "";
      }
      setMarks(preset);
    } catch (e) {
      // Results may be empty before marks exist — fall back to roster entry mode.
      setResults({ exam, students: [] });
      setMsg("No marks yet — enter below and submit.");
    } finally {
      setBusy(false);
    }
  };

  const lookupExam = (exams.data || []).find((e: any) => e.id === examId);
  const activeSubject = lookupExam?.subjects?.find((s: any) => s.id === examSubjectId);
  const maxMarks = activeSubject?.maxMarks;

  const submit = async () => {
    if (!examId || !examSubjectId) {
      setMsg("Pick an exam subject first.");
      return;
    }
    const roster = students.data?.length ? students.data : results?.students || [];
    const entries = roster.filter((s: any) => (marks[s.id] || "").trim() !== "");
    if (!entries.length) {
      setMsg("Enter at least one mark.");
      return;
    }
    for (const s of entries) {
      const raw = (marks[s.id] || "").trim();
      const n = Number(raw);
      if (!/^\d+(\.\d+)?$/.test(raw) || Number.isNaN(n) || n < 0) {
        setMsg(`Invalid mark for ${s.firstName} ${s.lastName}: use 0 or more.`);
        return;
      }
      if (maxMarks != null && n > maxMarks) {
        setMsg(`Invalid mark for ${s.firstName} ${s.lastName}: max is ${maxMarks}.`);
        return;
      }
    }
    const payload = entries.map((s: any) => ({ studentId: s.id, marksObtained: Number((marks[s.id] || "").trim()) }));
    setBusy(true);
    setMsg(null);
    try {
      const r = await mobileApi.enterMarks(examId, {
        examSubjectId,
        marks: payload,
      });
      setMsg(`Saved ${r.data?.updated ?? payload.length} marks for verification ✓`);
      queryClient.invalidateQueries({ queryKey: ["mobile"] });
      // Re-fetch to show saved values.
      try {
        const fresh = await mobileApi.examResults(examId);
        setResults(fresh);
        const preset: Record<string, string> = {};
        for (const s of fresh.students || []) {
          const subj = s.subjects?.[0];
          if (subj) preset[s.id] = subj.obtained != null ? String(subj.obtained) : "";
        }
        setMarks((prev) => ({ ...preset, ...Object.fromEntries(payload.map((p: any) => [p.studentId, String(p.marksObtained)])) }));
      } catch {
        // keep local entries on screen if re-fetch fails
      }
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (exams.isLoading) return <LoadingView message="Loading exams…" />;

  const activeExam = (exams.data || []).find((e: any) => e.id === examId);

  return (
    <Screen refreshing={exams.isFetching} onRefresh={() => exams.refetch()}>
      <SectionTitle>Examinations (enter marks before verification)</SectionTitle>
      <Text className="mb-2 text-xs text-slate-500">
        Only SCHEDULED / IN_PROGRESS exams accept marks. Publishing is done by authorized
        staff from the web dashboard.
      </Text>
      {!(exams.data || []).length ? (
        <EmptyView title="No examinations" />
      ) : (
        <View className="gap-2">
          {(exams.data || []).map((e: any) => (
            <Pressable key={e.id} onPress={() => openExam(e.id)}>
              <Card>
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-slate-900">{e.name}</Text>
                  <Pill text={e.status} tone={statusTone(e.status)} />
                </View>
                <Text className="text-xs text-slate-500">
                  {new Date(e.startDate).toLocaleDateString()} · Tap to enter marks
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      {!!examId && (
        <>
          <SectionTitle>Marks — {results?.exam?.name || activeExam?.name}</SectionTitle>
          {!!activeExam?.subjects?.length && (
            <View className="mb-2 flex-row flex-wrap gap-2">
              {activeExam.subjects.map((s: any) => (
                <Pressable
                  key={s.id}
                  onPress={() => setExamSubjectId(s.id)}
                  className={`rounded-full px-3 py-1.5 ${examSubjectId === s.id ? "bg-sidebar" : "bg-white"}`}
                >
                  <Text className={`text-xs font-semibold ${examSubjectId === s.id ? "text-white" : "text-slate-600"}`}>
                    {s.subject?.name} (max {s.maxMarks})
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {!!msg && <Text className="mb-2 text-sm text-slate-600">{msg}</Text>}
          <View className="gap-2">
            {((students.data?.length ? students.data : results?.students) || [])
              .slice(0, 100)
              .map((s: any) => (
                <Card key={s.id}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="font-semibold text-slate-900">
                        {s.firstName} {s.lastName}
                      </Text>
                      <Text className="text-xs text-slate-500">{s.admissionNumber}</Text>
                    </View>
                    <TextInput
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center"
                      keyboardType="numeric"
                      placeholder="—"
                      value={marks[s.id] || ""}
                      onChangeText={(v) => setMarks((p) => ({ ...p, [s.id]: v }))}
                    />
                  </View>
                </Card>
              ))}
          </View>
          <Pressable
            className="mt-3 items-center rounded-xl bg-primary-600 py-4"
            onPress={submit}
            disabled={busy}
          >
            <Text className="font-bold text-white">
              {busy ? "Saving…" : "Submit marks for verification"}
            </Text>
          </Pressable>
          <Text className="mt-2 text-xs text-slate-400">
            Marks follow the exam workflow (DRAFT → … → PUBLISHED). Unpublished results
            stay invisible to students.
          </Text>
        </>
      )}
      {busy && !examId && <LoadingView message="Loading results…" />}
    </Screen>
  );
}
