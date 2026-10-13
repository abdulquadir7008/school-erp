import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useExams, useTeacherStudents } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Avatar, Card, EmptyView, LoadingView, Pill, Screen, SectionHeader, statusTone } from "../../src/components/ui";

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
      const r = await mobileApi.enterMarks(examId, { examSubjectId, marks: payload });
      setMsg(`Saved ${r.data?.updated ?? payload.length} marks for verification`);
      queryClient.invalidateQueries({ queryKey: ["mobile"] });
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
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={exams.isFetching} onRefresh={() => exams.refetch()}>
        <SectionHeader title="Exams & marks" subtitle="Enter before verification" />
        <View className="mb-1 flex-row items-start gap-2 rounded-[20px] bg-amber-50 p-3.5">
          <Ionicons name="information-circle-outline" size={18} color="#B45309" />
          <Text className="flex-1 text-[12px] leading-5 text-amber-900">
            Only SCHEDULED / IN_PROGRESS exams accept marks. Publishing happens on the web dashboard.
          </Text>
        </View>
        {!(exams.data || []).length ? (
          <EmptyView title="No examinations" icon="document-text-outline" />
        ) : (
          <View className="gap-2.5">
            {(exams.data || []).map((e: any) => (
              <Pressable key={e.id} onPress={() => openExam(e.id)}>
                <Card className={examId === e.id ? "border-tealbrand-600 bg-teal-50/50" : ""}>
                  <View className="flex-row items-center gap-3">
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-violet-50">
                      <Ionicons name="document-text" size={20} color="#7C3AED" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-ink">{e.name}</Text>
                      <Text className="text-[12px] text-slate-500">{new Date(e.startDate).toLocaleDateString()} · Tap to enter marks</Text>
                    </View>
                    <Pill text={e.status} tone={statusTone(e.status)} />
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {!!examId && (
          <>
            <SectionHeader title={`Marks — ${results?.exam?.name || activeExam?.name}`} subtitle={maxMarks != null ? `Max ${maxMarks}` : undefined} />
            {!!activeExam?.subjects?.length && (
              <View className="mb-2 flex-row flex-wrap gap-2">
                {activeExam.subjects.map((s: any) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setExamSubjectId(s.id)}
                    className={`rounded-full px-3.5 py-2 ${examSubjectId === s.id ? "bg-ink" : "border border-slate-200 bg-white"}`}
                  >
                    <Text className={`text-[12px] font-bold ${examSubjectId === s.id ? "text-white" : "text-slate-600"}`}>
                      {s.subject?.name} · {s.maxMarks}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {!!msg && (
              <View className="mb-2.5 rounded-2xl bg-slate-100 p-3">
                <Text className="text-[13px] font-semibold text-slate-700">{msg}</Text>
              </View>
            )}
            <View className="gap-2">
              {((students.data?.length ? students.data : results?.students) || []).slice(0, 100).map((s: any) => (
                <Card key={s.id}>
                  <View className="flex-row items-center gap-3">
                    <Avatar name={`${s.firstName} ${s.lastName}`} size={38} bg="#0D9488" />
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-ink">{s.firstName} {s.lastName}</Text>
                      <Text className="text-[12px] text-slate-500">{s.admissionNumber}</Text>
                    </View>
                    <TextInput
                      className="w-[72px] rounded-xl bg-slate-50 px-2 py-2.5 text-center text-[15px] font-bold text-ink"
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor="#94A3B8"
                      value={marks[s.id] || ""}
                      onChangeText={(v) => setMarks((p) => ({ ...p, [s.id]: v }))}
                    />
                  </View>
                </Card>
              ))}
            </View>
            <Pressable className="mt-3.5 items-center rounded-2xl bg-tealbrand-600 py-4 active:opacity-85" onPress={submit} disabled={busy} style={{ opacity: busy ? 0.7 : 1 }}>
              <Text className="text-[15px] font-extrabold text-white">{busy ? "Saving…" : "Submit for verification"}</Text>
            </Pressable>
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
