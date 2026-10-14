import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useExams, useMarksRoster } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, ProgressBar, Screen, SectionHeader } from "../../src/components/ui";

export default function TeacherExams() {
  const queryClient = useQueryClient();
  const exams = useExams();
  const [examId, setExamId] = useState<string | null>(null);
  const [examSubjectId, setExamSubjectId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, { value: string; absent: boolean; exempt: boolean }>>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const roster = useMarksRoster(examId || undefined, examSubjectId || undefined);

  const exam = useMemo(() => (exams.data || []).find((e: any) => e.id === examId), [exams.data, examId]);
  const maxMarks = useMemo(
    () => exam?.subjects?.find((s: any) => s.id === examSubjectId)?.maxMarks,
    [exam, examSubjectId]
  );

  const rows = useMemo(() => {
    const list = roster.data?.students || [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((r: any) =>
      `${r.student.firstName} ${r.student.lastName} ${r.student.admissionNumber}`.toLowerCase().includes(q)
    );
  }, [roster.data, search]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "exams"] });
    if (examId && examSubjectId) {
      queryClient.invalidateQueries({ queryKey: ["mobile", "marks-roster", examId, examSubjectId] });
    }
  };

  const entryOf = (row: any) =>
    marks[row.student.id] || {
      value: row.mark?.marksObtained != null ? String(row.mark.marksObtained) : "",
      absent: !!row.mark?.isAbsent,
      exempt: !!row.mark?.isExempt,
    };

  const save = async () => {
    if (!examId || !examSubjectId) {
      setMsg("Pick an exam and subject first.");
      return;
    }
    const payload = [];
    for (const r of rows) {
      const e = entryOf(r);
      const prev = {
        value: r.mark?.marksObtained != null ? String(r.mark.marksObtained) : "",
        absent: !!r.mark?.isAbsent,
        exempt: !!r.mark?.isExempt,
      };
      if (e.value === prev.value && e.absent === prev.absent && e.exempt === prev.exempt) continue;
      if (!e.absent && !e.exempt && e.value.trim() === "") continue;
      const n = e.value.trim() === "" ? null : Number(e.value.trim());
      if (n != null && (!/^\d+$/.test(e.value.trim()) || n < 0)) {
        setMsg(`Invalid mark for ${r.student.firstName} ${r.student.lastName}.`);
        return;
      }
      if (maxMarks != null && n != null && n > maxMarks) {
        setMsg(`Max is ${maxMarks} for ${r.student.firstName} ${r.student.lastName}.`);
        return;
      }
      payload.push({ studentId: r.student.id, marksObtained: n, isAbsent: e.absent, isExempt: e.exempt });
    }
    if (!payload.length) {
      setMsg("No changes to save.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await mobileApi.enterMarks(examId, { examSubjectId, marks: payload });
      setMsg(`Saved ${r.data?.updated ?? payload.length} marks as draft.`);
      setMarks({});
      refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!examId || !examSubjectId) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await mobileApi.submitMarksReview(examId, { examSubjectId });
      setMsg(`Submitted ${r.data?.submitted ?? 0} marks for approval.`);
      refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (exams.isLoading) return <LoadingView message="Loading exams…" />;
  if (exams.isError) {
    return (
      <Screen refreshing={false} onRefresh={() => exams.refetch()}>
        <ErrorView message={getApiErrorMessage(exams.error)} onRetry={() => exams.refetch()} />
      </Screen>
    );
  }

  const progress = roster.data?.progress;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={false} onRefresh={() => { exams.refetch(); refresh(); }}>
        <SectionHeader title="Examinations" subtitle="Your assigned subjects" />
        {!(exams.data || []).length ? (
          <EmptyView title="No assigned exams" hint="Exams for your subjects will appear here." icon="document-text-outline" />
        ) : (
          <View className="gap-2.5">
            {(exams.data || []).map((e: any) => {
              const active = examId === e.id;
              const eligible = e.progress?.eligible ?? 0;
              const entered = e.progress?.entered ?? 0;
              return (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    setExamId(active ? null : e.id);
                    setExamSubjectId(null);
                    setMarks({});
                    setSearch("");
                  }}
                >
                  <Card className={active ? "border-2 border-tealbrand-600" : ""}>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>{e.name}</Text>
                      <Pill text={e.status} tone={e.status === "PUBLISHED" ? "green" : e.status === "DRAFT" ? "amber" : "slate"} />
                    </View>
                    <Text className="mt-0.5 text-[12px] text-slate-500">
                      {e.type} · {(e.mySubjects || []).map((s: any) => s.subject?.name).join(", ")}
                    </Text>
                    {!!eligible && (
                      <View className="mt-2">
                        <ProgressBar value={entered} total={eligible} color="#0D9488" />
                        <Text className="mt-1 text-[11px] font-bold text-slate-600">
                          {entered}/{eligible} marks entered
                          {!!e.progress?.submitted && ` · ${e.progress.submitted} in review`}
                          {!!e.progress?.approved && ` · ${e.progress.approved} approved`}
                        </Text>
                      </View>
                    )}
                    {active && !!(e.mySubjects || []).length && (
                      <View className="mt-2 flex-row flex-wrap gap-2">
                        {e.mySubjects.map((s: any) => (
                          <Pressable
                            key={s.id}
                            onPress={() => { setExamSubjectId(s.id); setMarks({}); }}
                            className={`rounded-full px-3 py-2 ${examSubjectId === s.id ? "bg-ink" : "bg-slate-100"}`}
                          >
                            <Text className={`text-[11px] font-bold ${examSubjectId === s.id ? "text-white" : "text-slate-700"}`}>
                              {s.subject?.name} · max {s.maxMarks}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {!!msg && (
          <View className="mt-3 rounded-2xl bg-teal-50 p-3">
            <Text className="text-[13px] font-semibold text-teal-900">{msg}</Text>
          </View>
        )}

        {!!examId && !!examSubjectId && (
          <Card className="mt-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[14px] font-extrabold text-ink">
                Marks{progress ? ` · ${progress.entered}/${progress.total}` : ""}
              </Text>
              <View className="flex-row gap-2">
                <Pressable className="rounded-2xl bg-tealbrand-600 px-4 py-2.5" onPress={save} disabled={busy}>
                  <Text className="text-[12px] font-extrabold text-white">Save</Text>
                </Pressable>
                <Pressable className="rounded-2xl bg-ink px-4 py-2.5" onPress={submitReview} disabled={busy}>
                  <Text className="text-[12px] font-extrabold text-white">Submit</Text>
                </Pressable>
              </View>
            </View>
            <View className="mt-2 flex-row items-center gap-2 rounded-2xl bg-slate-50 px-4">
              <Ionicons name="search-outline" size={16} color="#94A3B8" />
              <TextInput className="flex-1 py-2.5 text-[14px] text-ink" value={search} onChangeText={setSearch} placeholder="Search student…" placeholderTextColor="#94A3B8" />
            </View>
            {roster.isLoading ? (
              <LoadingView message="Loading roster…" />
            ) : roster.isError ? (
              <ErrorView message={getApiErrorMessage(roster.error)} onRetry={() => roster.refetch()} />
            ) : !rows.length ? (
              <EmptyView title="No students" hint="No eligible students for this subject." icon="people-outline" />
            ) : (
              <View className="mt-2 gap-2">
                {rows.map((r: any) => {
                  const e = entryOf(r);
                  const st = r.mark?.status || "NOT_ENTERED";
                  const locked = st === "SUBMITTED" || st === "APPROVED";
                  return (
                    <View key={r.student.id} className="rounded-2xl bg-slate-50 p-3">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="flex-1 text-[13px] font-bold text-ink" numberOfLines={1}>
                          {r.student.firstName} {r.student.lastName}
                          <Text className="font-normal text-slate-500"> · {r.student.admissionNumber}</Text>
                        </Text>
                        <Pill text={st.replace(/_/g, " ")} tone={st === "APPROVED" ? "green" : st === "REJECTED" ? "red" : st === "SUBMITTED" ? "violet" : "amber"} />
                      </View>
                      {!!r.mark?.reviewNote && (
                        <Text className="mt-1 text-[12px] italic text-red-600">Reviewer: {r.mark.reviewNote}</Text>
                      )}
                      <View className="mt-2 flex-row items-center gap-2">
                        <TextInput
                          className="w-20 rounded-xl bg-white px-3 py-2 text-center text-[14px] font-bold text-ink"
                          value={e.value}
                          onChangeText={(v) => setMarks((p) => ({ ...p, [r.student.id]: { ...e, value: v } }))}
                          placeholder="—"
                          keyboardType="numeric"
                          editable={!locked && !e.absent && !e.exempt}
                          placeholderTextColor="#94A3B8"
                        />
                        <Pressable
                          className={`rounded-full px-3 py-1.5 ${e.absent ? "bg-red-600" : "bg-white"}`}
                          disabled={locked}
                          onPress={() => setMarks((p) => ({ ...p, [r.student.id]: { ...e, absent: !e.absent, exempt: false } }))}
                        >
                          <Text className={`text-[11px] font-bold ${e.absent ? "text-white" : "text-slate-600"}`}>Absent</Text>
                        </Pressable>
                        <Pressable
                          className={`rounded-full px-3 py-1.5 ${e.exempt ? "bg-slate-700" : "bg-white"}`}
                          disabled={locked}
                          onPress={() => setMarks((p) => ({ ...p, [r.student.id]: { ...e, exempt: !e.exempt, absent: false } }))}
                        >
                          <Text className={`text-[11px] font-bold ${e.exempt ? "text-white" : "text-slate-600"}`}>Exempt</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        )}
      </Screen>
    </SafeAreaView>
  );
}
