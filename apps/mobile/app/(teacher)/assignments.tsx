import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useTeacherAssignments, useTeacherClasses, useTeacherSubmissions } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { Card, EmptyView, ErrorView, LoadingView, Pill, ProgressBar, Screen, SectionHeader } from "../../src/components/ui";

const TYPES = ["INDIVIDUAL", "GROUP", "PROJECT", "PRACTICAL", "RESEARCH"];
const FILTERS = ["ALL", "NOT_SUBMITTED", "SUBMITTED", "LATE_SUBMITTED", "RETURNED_FOR_REVISION", "GRADED"];
const GRADE_STATUS = ["UNDER_REVIEW", "GRADED", "RETURNED_FOR_REVISION"];

export default function TeacherAssignments() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const classes = useTeacherClasses();
  const tracked = useTeacherAssignments();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [totalMarks, setTotalMarks] = useState("100");
  const [type, setType] = useState("INDIVIDUAL");
  const [asDraft, setAsDraft] = useState(false);
  const [allowLate, setAllowLate] = useState(false);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, { marks: string; feedback: string; status: string }>>({});
  const [saving, setSaving] = useState(false);

  const submissions = useTeacherSubmissions(
    selectedId || undefined,
    filter === "ALL" ? undefined : filter,
    search.trim() || undefined
  );

  const targets = useMemo(() => {
    const map = new Map<string, { classId: string; subjectId: string; className: string; subjectName: string }>();
    for (const e of classes.data || []) {
      const classId = e.classId || e.class?.id;
      const subjectId = e.subjectId || e.subject?.id;
      if (!classId || !subjectId) continue;
      const key = `${classId}:${subjectId}`;
      if (!map.has(key)) {
        map.set(key, { classId, subjectId, className: e.class?.name || classId, subjectName: e.subject?.name || subjectId });
      }
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [classes.data]);

  const selected = targets.find((t) => t.key === targetKey) || targets[0] || null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "teacher-assignments"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ["mobile", "teacher-submissions", selectedId] });
  };

  const create = async () => {
    if (!selected || !user?.schoolId) {
      setMsg("Pick a class and subject first.");
      return;
    }
    if (!title.trim()) {
      setMsg("Add a title first.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim()) || Number.isNaN(new Date(dueDate).getTime())) {
      setMsg("Due date must be YYYY-MM-DD.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await mobileApi.createFullAssignment({
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        classId: selected.classId,
        subjectId: selected.subjectId,
        type,
        dueDate: new Date(dueDate).toISOString(),
        allowLateSubmission: allowLate,
        totalMarks: totalMarks.trim() ? Number(totalMarks) : undefined,
        status: asDraft ? "DRAFT" : "PUBLISHED",
        schoolId: user.schoolId,
      });
      setMsg(`Assignment ${asDraft ? "saved as draft" : "published"} to ${selected.className} · ${selected.subjectName}`);
      setTitle("");
      setInstructions("");
      refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const transition = async (id: string, action: "publish" | "close" | "reopen" | "archive" | "duplicate") => {
    try {
      await mobileApi.transitionAssignment(id, action);
      setMsg(`Assignment ${action}d.`);
      refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  };

  const saveRow = async (studentId: string, fallback: any) => {
    if (!selectedId) return;
    const e = edits[studentId] || {
      marks: fallback.marksObtained != null ? String(fallback.marksObtained) : "",
      feedback: fallback.feedback || "",
      status: GRADE_STATUS.includes(fallback.status) ? fallback.status : "UNDER_REVIEW",
    };
    setSaving(true);
    try {
      await mobileApi.gradeAssignment(selectedId, [
        {
          studentId,
          marksObtained: e.marks === "" ? undefined : Number(e.marks),
          feedback: e.feedback || undefined,
          status: e.status,
        },
      ]);
      setEdits((p) => {
        const next = { ...p };
        delete next[studentId];
        return next;
      });
      refresh();
    } catch (err) {
      setMsg(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const publishGrades = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await mobileApi.publishAssignmentGrades(selectedId);
      setMsg(`Published ${res.published} grades. Students notified.`);
      refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const openFile = async (doc: any) => {
    try {
      const uri = await mobileApi.downloadAssignmentFile(doc.documentId, doc.name || "file");
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else setMsg(`Saved to ${uri}`);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  };

  if (classes.isLoading) return <LoadingView message="Loading…" />;
  if (classes.isError) {
    return (
      <Screen refreshing={false} onRefresh={() => classes.refetch()}>
        <ErrorView message={getApiErrorMessage(classes.error)} onRetry={() => classes.refetch()} />
      </Screen>
    );
  }

  const rows = submissions.data?.students || [];
  const stats = submissions.data?.stats;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={false} onRefresh={() => { classes.refetch(); refresh(); }}>
        <SectionHeader title="Assignments" subtitle="Create, track and grade" />
        {!targets.length ? (
          <EmptyView title="No classes assigned" hint="Your timetable has no class/subject entries yet." icon="create-outline" />
        ) : (
          <Card>
            <Text className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Assign to</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {targets.map((t) => (
                <Pressable key={t.key} onPress={() => setTargetKey(t.key)} className={`rounded-full px-3.5 py-2 ${selected?.key === t.key ? "bg-tealbrand-600" : "bg-slate-100"}`}>
                  <Text className={`text-[12px] font-bold ${selected?.key === t.key ? "text-white" : "text-slate-700"}`}>{t.className} · {t.subjectName}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-400">Title</Text>
            <TextInput className="rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] text-ink" value={title} onChangeText={setTitle} placeholder="e.g. Solar system project" placeholderTextColor="#94A3B8" />
            <Text className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-400">Instructions</Text>
            <TextInput className="rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] text-ink" value={instructions} onChangeText={setInstructions} placeholder="Steps, format, rules…" multiline numberOfLines={3} textAlignVertical="top" placeholderTextColor="#94A3B8" />
            <Text className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-400">Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {TYPES.map((t) => (
                <Pressable key={t} onPress={() => setType(t)} className={`rounded-full px-3 py-2 ${type === t ? "bg-tealbrand-600" : "bg-slate-100"}`}>
                  <Text className={`text-[11px] font-bold ${type === t ? "text-white" : "text-slate-600"}`}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-4 flex-row gap-2">
              <View className="flex-1">
                <Text className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-400">Deadline</Text>
                <View className="flex-row items-center gap-2 rounded-2xl bg-slate-50 px-4">
                  <Ionicons name="calendar-outline" size={18} color="#94A3B8" />
                  <TextInput className="flex-1 py-3.5 text-[15px] text-ink" value={dueDate} onChangeText={setDueDate} placeholder="2026-11-30" placeholderTextColor="#94A3B8" />
                </View>
              </View>
              <View className="flex-1">
                <Text className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-400">Max marks</Text>
                <TextInput className="rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] text-ink" value={totalMarks} onChangeText={setTotalMarks} placeholder="100" keyboardType="numeric" placeholderTextColor="#94A3B8" />
              </View>
            </View>
            <View className="mt-3 flex-row gap-2">
              <Pressable className="flex-1 flex-row items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3" onPress={() => setAllowLate((v) => !v)}>
                <Ionicons name={allowLate ? "checkbox" : "square-outline"} size={20} color="#0D9488" />
                <Text className="text-[12px] font-bold text-slate-700">Allow late</Text>
              </Pressable>
              <Pressable className="flex-1 flex-row items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3" onPress={() => setAsDraft((v) => !v)}>
                <Ionicons name={asDraft ? "checkbox" : "square-outline"} size={20} color="#0D9488" />
                <Text className="text-[12px] font-bold text-slate-700">Save as draft</Text>
              </Pressable>
            </View>
            {!!msg && (
              <View className="mt-3 rounded-2xl bg-teal-50 p-3">
                <Text className="text-[13px] font-semibold text-teal-900">{msg}</Text>
              </View>
            )}
            <Pressable className="mt-4 items-center rounded-2xl bg-tealbrand-600 py-3.5 active:opacity-85" onPress={create} disabled={busy}>
              <Text className="text-[14px] font-extrabold text-white">{asDraft ? "Save draft" : "Publish assignment"}</Text>
            </Pressable>
          </Card>
        )}

        <SectionHeader title="Tracked" subtitle={tracked.data ? `${tracked.data.length} assignments` : "Submissions & grading"} />
        {tracked.isLoading ? (
          <LoadingView message="Loading assignments…" />
        ) : tracked.isError ? (
          <ErrorView message={getApiErrorMessage(tracked.error)} onRetry={() => tracked.refetch()} />
        ) : !tracked.data?.length ? (
          <EmptyView title="No assignments yet" hint="Publish one above to start tracking." icon="clipboard-outline" />
        ) : (
          <View className="gap-2.5">
            {tracked.data.map((a: any) => {
              const total = a.stats?.total ?? 0;
              const done = a.stats?.submitted ?? 0;
              const active = selectedId === a.id;
              return (
                <Pressable key={a.id} onPress={() => { setSelectedId(active ? null : a.id); setEdits({}); setSearch(""); setFilter("ALL"); }}>
                  <Card className={active ? "border-2 border-tealbrand-600" : ""}>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>{a.title}</Text>
                      <Pill text={a.status} tone={a.status === "PUBLISHED" ? "green" : a.status === "DRAFT" ? "amber" : "slate"} />
                    </View>
                    <Text className="mt-0.5 text-[12px] text-slate-500">
                      {a.class?.name}{a.section?.name ? `-${a.section.name}` : ""} · {a.type} · Due {new Date(a.dueDate).toLocaleDateString()}
                    </Text>
                    <View className="mt-2">
                      <ProgressBar value={done} total={Math.max(total, 1)} color="#0D9488" />
                    </View>
                    <Text className="mt-1 text-[12px] font-bold text-slate-600">
                      {done}/{total} submitted · {a.stats?.graded ?? 0} graded{a.stats?.averageMarks != null ? ` · avg ${a.stats.averageMarks}` : ""}
                    </Text>
                    {active && (
                      <View className="mt-2 flex-row flex-wrap gap-2">
                        {a.status === "DRAFT" && (
                          <Pressable className="rounded-full bg-green-100 px-3 py-1.5" onPress={() => transition(a.id, "publish")}>
                            <Text className="text-[11px] font-bold text-green-800">Publish</Text>
                          </Pressable>
                        )}
                        {a.status === "PUBLISHED" && (
                          <Pressable className="rounded-full bg-amber-100 px-3 py-1.5" onPress={() => transition(a.id, "close")}>
                            <Text className="text-[11px] font-bold text-amber-800">Close</Text>
                          </Pressable>
                        )}
                        {a.status === "CLOSED" && (
                          <Pressable className="rounded-full bg-sky-100 px-3 py-1.5" onPress={() => transition(a.id, "reopen")}>
                            <Text className="text-[11px] font-bold text-sky-800">Reopen</Text>
                          </Pressable>
                        )}
                        <Pressable className="rounded-full bg-slate-100 px-3 py-1.5" onPress={() => transition(a.id, "duplicate")}>
                          <Text className="text-[11px] font-bold text-slate-700">Duplicate</Text>
                        </Pressable>
                      </View>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {!!selectedId && (
          <Card className="mt-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[14px] font-extrabold text-ink">
                Submissions{stats ? ` · ${stats.submitted}/${stats.total}` : ""}
              </Text>
              <Pressable onPress={() => setSelectedId(null)}>
                <Ionicons name="close-circle-outline" size={22} color="#64748B" />
              </Pressable>
            </View>
            <Pressable className="mt-2 items-center rounded-2xl bg-tealbrand-600 py-2.5" onPress={publishGrades} disabled={saving}>
              <Text className="text-[12px] font-extrabold text-white">Publish grades</Text>
            </Pressable>
            <View className="mt-2 flex-row flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <Pressable key={f} onPress={() => setFilter(f)} className={`rounded-full px-3 py-1.5 ${filter === f ? "bg-ink" : "bg-slate-100"}`}>
                  <Text className={`text-[11px] font-bold ${filter === f ? "text-white" : "text-slate-600"}`}>{f.replace(/_/g, " ")}</Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-2 flex-row items-center gap-2 rounded-2xl bg-slate-50 px-4">
              <Ionicons name="search-outline" size={16} color="#94A3B8" />
              <TextInput className="flex-1 py-2.5 text-[14px] text-ink" value={search} onChangeText={setSearch} placeholder="Search student…" placeholderTextColor="#94A3B8" />
            </View>
            {submissions.isLoading ? (
              <LoadingView message="Loading submissions…" />
            ) : submissions.isError ? (
              <ErrorView message={getApiErrorMessage(submissions.error)} onRetry={() => submissions.refetch()} />
            ) : !rows.length ? (
              <EmptyView title="No submissions" hint="Nobody in this filter yet." icon="people-outline" />
            ) : (
              <View className="mt-2 gap-2">
                {rows.map((r: any) => {
                  const current = r.submission?.status || "NOT_SUBMITTED";
                  const e = edits[r.student.id] || {
                    marks: r.submission?.marksObtained != null ? String(r.submission.marksObtained) : "",
                    feedback: r.submission?.feedback || "",
                    status: GRADE_STATUS.includes(current) ? current : "UNDER_REVIEW",
                  };
                  const dirty =
                    e.marks !== (r.submission?.marksObtained != null ? String(r.submission.marksObtained) : "") ||
                    e.feedback !== (r.submission?.feedback || "") ||
                    e.status !== current;
                  const files = Array.isArray(r.submission?.attachments) ? r.submission.attachments : [];
                  return (
                    <View key={r.student.id} className="rounded-2xl bg-slate-50 p-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="flex-1 text-[13px] font-bold text-ink" numberOfLines={1}>
                          {r.student.firstName} {r.student.lastName}
                          <Text className="font-normal text-slate-500"> · {r.student.admissionNumber}</Text>
                        </Text>
                        <Pill text={current.replace(/_/g, " ")} tone={current === "GRADED" ? "green" : current === "NOT_SUBMITTED" ? "amber" : "violet"} />
                      </View>
                      {!!r.submission?.submissionText && (
                        <Text className="mt-1.5 text-[13px] leading-5 text-slate-700" numberOfLines={3}>{r.submission.submissionText}</Text>
                      )}
                      {!!files.length && (
                        <View className="mt-1.5 gap-1">
                          {files.map((d: any) => (
                            <Pressable key={d.documentId} className="flex-row items-center gap-2 rounded-xl bg-white px-3 py-2" onPress={() => openFile(d)}>
                              <Ionicons name="download-outline" size={15} color="#0D9488" />
                              <Text className="flex-1 text-[12px] font-semibold text-teal-900" numberOfLines={1}>{d.name}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                      <View className="mt-2 flex-row gap-1.5">
                        {GRADE_STATUS.map((s) => {
                          const on = e.status === s;
                          return (
                            <Pressable key={s} onPress={() => setEdits((p) => ({ ...p, [r.student.id]: { ...e, status: s } }))} className={`rounded-full px-2.5 py-1.5 ${on ? "bg-tealbrand-600" : "bg-white"}`}>
                              <Text className={`text-[10px] font-bold ${on ? "text-white" : "text-slate-600"}`}>{s.replace(/_/g, " ")}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View className="mt-2 flex-row gap-2">
                        <TextInput className="w-20 rounded-xl bg-white px-3 py-2 text-[13px] text-ink" value={e.marks} onChangeText={(v) => setEdits((p) => ({ ...p, [r.student.id]: { ...e, marks: v } }))} placeholder="Marks" keyboardType="numeric" placeholderTextColor="#94A3B8" />
                        <TextInput className="flex-1 rounded-xl bg-white px-3 py-2 text-[13px] text-ink" value={e.feedback} onChangeText={(v) => setEdits((p) => ({ ...p, [r.student.id]: { ...e, feedback: v } }))} placeholder="Feedback…" placeholderTextColor="#94A3B8" />
                      </View>
                      {dirty && (
                        <Pressable className="mt-2 items-center rounded-xl bg-ink py-2.5" onPress={() => saveRow(r.student.id, r.submission)} disabled={saving}>
                          <Text className="text-[12px] font-extrabold text-white">Save grade</Text>
                        </Pressable>
                      )}
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
