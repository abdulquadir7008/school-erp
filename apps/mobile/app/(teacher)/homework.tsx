import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useTeacherClasses, useTeacherCompletions, useTeacherHomework } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { Card, EmptyView, ErrorView, LoadingView, Pill, ProgressBar, Screen, SectionHeader } from "../../src/components/ui";

const ROW_STATUS: { key: string; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "COMPLETED", label: "Done" },
  { key: "NOT_SUBMITTED", label: "Missing" },
];

export default function TeacherHomework() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const classes = useTeacherClasses();
  const tracked = useTeacherHomework();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, { status: string; teacherRemark: string }>>({});
  const [saving, setSaving] = useState(false);

  const completions = useTeacherCompletions(selectedId || undefined);

  const targets = useMemo(() => {
    const map = new Map<string, { classId: string; subjectId: string; className: string; subjectName: string }>();
    for (const e of classes.data || []) {
      const classId = e.classId || e.class?.id;
      const subjectId = e.subjectId || e.subject?.id;
      if (!classId || !subjectId) continue;
      const key = `${classId}:${subjectId}`;
      if (!map.has(key)) {
        map.set(key, {
          classId,
          subjectId,
          className: e.class?.name || classId,
          subjectName: e.subject?.name || subjectId,
        });
      }
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [classes.data]);

  const selected = targets.find((t) => t.key === targetKey) || targets[0] || null;

  const submit = async (kind: "homework" | "assignment") => {
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
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        classId: selected.classId,
        subjectId: selected.subjectId,
        dueDate: new Date(dueDate).toISOString(),
        schoolId: user.schoolId,
      };
      if (kind === "homework") await mobileApi.createHomework(payload);
      else await mobileApi.createAssignment(payload);
      setMsg(`${kind === "homework" ? "Homework" : "Assignment"} published to ${selected.className} · ${selected.subjectName}`);
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["mobile"] });
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshTracked = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "teacher-homework"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ["mobile", "teacher-completions", selectedId] });
  };

  const saveRow = async (studentId: string, fallbackStatus: string, fallbackRemark?: string | null) => {
    if (!selectedId) return;
    const e = edits[studentId] || { status: fallbackStatus, teacherRemark: fallbackRemark || "" };
    setSaving(true);
    try {
      await mobileApi.updateTeacherCompletions(selectedId, [
        { studentId, status: e.status, teacherRemark: e.teacherRemark || undefined },
      ]);
      setEdits((p) => {
        const next = { ...p };
        delete next[studentId];
        return next;
      });
      refreshTracked();
    } catch (err) {
      setMsg(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const markAll = async (to: string) => {
    if (!selectedId || !completions.data?.students?.length) return;
    setSaving(true);
    try {
      await mobileApi.updateTeacherCompletions(
        selectedId,
        completions.data.students.map((r: any) => ({ studentId: r.student.id, status: to }))
      );
      setEdits({});
      refreshTracked();
    } catch (err) {
      setMsg(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    const list = completions.data?.students || [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((r: any) =>
      `${r.student.firstName} ${r.student.lastName} ${r.student.admissionNumber}`.toLowerCase().includes(q)
    );
  }, [completions.data, search]);

  if (classes.isLoading) return <LoadingView message="Loading…" />;
  if (classes.isError) {
    return (
      <Screen refreshing={false} onRefresh={() => classes.refetch()}>
        <ErrorView message={getApiErrorMessage(classes.error)} onRetry={() => classes.refetch()} />
      </Screen>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={false} onRefresh={() => { classes.refetch(); refreshTracked(); }}>
        <SectionHeader title="Publish work" subtitle="Homework or graded assignment" />
        {!targets.length ? (
          <EmptyView title="No classes assigned" hint="Your timetable has no class/subject entries yet." icon="create-outline" />
        ) : (
          <Card>
            <Text className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Post to</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {targets.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setTargetKey(t.key)}
                  className={`rounded-full px-3.5 py-2 ${selected?.key === t.key ? "bg-tealbrand-600" : "bg-slate-100"}`}
                >
                  <Text className={`text-[12px] font-bold ${selected?.key === t.key ? "text-white" : "text-slate-700"}`}>
                    {t.className} · {t.subjectName}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-400">Title</Text>
            <TextInput className="rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] text-ink" value={title} onChangeText={setTitle} placeholder="e.g. Chapter 5 exercises" placeholderTextColor="#94A3B8" />
            <Text className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-400">Instructions</Text>
            <TextInput
              className="rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] text-ink"
              value={description} onChangeText={setDescription} placeholder="Details for students…"
              multiline numberOfLines={3} textAlignVertical="top" placeholderTextColor="#94A3B8"
            />
            <Text className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-400">Due date</Text>
            <View className="flex-row items-center gap-2 rounded-2xl bg-slate-50 px-4">
              <Ionicons name="calendar-outline" size={18} color="#94A3B8" />
              <TextInput className="flex-1 py-3.5 text-[15px] text-ink" value={dueDate} onChangeText={setDueDate} placeholder="2026-10-20" placeholderTextColor="#94A3B8" />
            </View>
            {!!msg && (
              <View className="mt-3 rounded-2xl bg-teal-50 p-3">
                <Text className="text-[13px] font-semibold text-teal-900">{msg}</Text>
              </View>
            )}
            <View className="mt-4 flex-row gap-2">
              <Pressable className="flex-1 items-center rounded-2xl bg-tealbrand-600 py-3.5 active:opacity-85" onPress={() => submit("homework")} disabled={busy}>
                <Text className="text-[14px] font-extrabold text-white">Post homework</Text>
              </Pressable>
              <Pressable className="flex-1 items-center rounded-2xl bg-ink py-3.5 active:opacity-85" onPress={() => submit("assignment")} disabled={busy}>
                <Text className="text-[14px] font-extrabold text-white">Assignment</Text>
              </Pressable>
            </View>
          </Card>
        )}

        <SectionHeader
          title="Tracked homework"
          subtitle={tracked.data ? `${tracked.data.length} items` : "Completion tracking"}
        />
        {tracked.isLoading ? (
          <LoadingView message="Loading tracked homework…" />
        ) : tracked.isError ? (
          <ErrorView message={getApiErrorMessage(tracked.error)} onRetry={() => tracked.refetch()} />
        ) : !tracked.data?.length ? (
          <EmptyView title="Nothing tracked yet" hint="Post homework above to start tracking completion." icon="clipboard-outline" />
        ) : (
          <View className="gap-2.5">
            {tracked.data.map((h: any) => {
              const total = h.stats?.total ?? 0;
              const done = h.stats?.completed ?? 0;
              const active = selectedId === h.id;
              return (
                <Pressable key={h.id} onPress={() => { setSelectedId(active ? null : h.id); setEdits({}); setSearch(""); }}>
                  <Card className={active ? "border-2 border-tealbrand-600" : ""}>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>{h.title}</Text>
                      <Pill text={`${done}/${total} done`} tone={total > 0 && done === total ? "green" : "amber"} />
                    </View>
                    <Text className="mt-0.5 text-[12px] text-slate-500">
                      {h.class?.name}{h.section?.name ? `-${h.section.name}` : ""} · {h.subject?.name || "General"} · Due {new Date(h.dueDate).toLocaleDateString()}
                    </Text>
                    <View className="mt-2">
                      <ProgressBar value={done} total={Math.max(total, 1)} color="#0D9488" />
                    </View>
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
                Completion{completions.data?.stats ? ` · ${completions.data.stats.completed}/${completions.data.stats.total}` : ""}
              </Text>
              <Pressable onPress={() => setSelectedId(null)}>
                <Ionicons name="close-circle-outline" size={22} color="#64748B" />
              </Pressable>
            </View>
            <View className="mt-2 flex-row gap-2">
              <Pressable className="flex-1 items-center rounded-2xl bg-tealbrand-600 py-2.5" onPress={() => markAll("COMPLETED")} disabled={saving}>
                <Text className="text-[12px] font-extrabold text-white">All completed</Text>
              </Pressable>
              <Pressable className="flex-1 items-center rounded-2xl bg-slate-100 py-2.5" onPress={() => markAll("PENDING")} disabled={saving}>
                <Text className="text-[12px] font-extrabold text-slate-700">Reset pending</Text>
              </Pressable>
            </View>
            <View className="mt-2 flex-row items-center gap-2 rounded-2xl bg-slate-50 px-4">
              <Ionicons name="search-outline" size={16} color="#94A3B8" />
              <TextInput className="flex-1 py-2.5 text-[14px] text-ink" value={search} onChangeText={setSearch} placeholder="Search student…" placeholderTextColor="#94A3B8" />
            </View>
            {completions.isLoading ? (
              <LoadingView message="Loading students…" />
            ) : completions.isError ? (
              <ErrorView message={getApiErrorMessage(completions.error)} onRetry={() => completions.refetch()} />
            ) : !rows.length ? (
              <EmptyView title="No students" hint="No students match this homework scope." icon="people-outline" />
            ) : (
              <View className="mt-2 gap-2">
                {rows.map((r: any) => {
                  const current = r.submission?.status || "PENDING";
                  const e = edits[r.student.id] || { status: current, teacherRemark: r.submission?.teacherRemark || "" };
                  const dirty = e.status !== current || (e.teacherRemark || "") !== (r.submission?.teacherRemark || "");
                  return (
                    <View key={r.student.id} className="rounded-2xl bg-slate-50 p-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="flex-1 text-[13px] font-bold text-ink" numberOfLines={1}>
                          {r.student.firstName} {r.student.lastName}
                          <Text className="font-normal text-slate-500"> · {r.student.admissionNumber}</Text>
                        </Text>
                      </View>
                      <View className="mt-2 flex-row gap-1.5">
                        {ROW_STATUS.map((s) => {
                          const on = e.status === s.key;
                          return (
                            <Pressable
                              key={s.key}
                              onPress={() => setEdits((p) => ({ ...p, [r.student.id]: { ...e, status: s.key } }))}
                              className={`rounded-full px-3 py-1.5 ${on ? "bg-tealbrand-600" : "bg-white"}`}
                            >
                              <Text className={`text-[11px] font-bold ${on ? "text-white" : "text-slate-600"}`}>{s.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <TextInput
                        className="mt-2 rounded-xl bg-white px-3 py-2 text-[13px] text-ink"
                        value={e.teacherRemark}
                        onChangeText={(v) => setEdits((p) => ({ ...p, [r.student.id]: { ...e, teacherRemark: v } }))}
                        placeholder="Remark (optional)…"
                        placeholderTextColor="#94A3B8"
                      />
                      {dirty && (
                        <Pressable
                          className="mt-2 items-center rounded-xl bg-ink py-2.5"
                          onPress={() => saveRow(r.student.id, current, r.submission?.teacherRemark)}
                          disabled={saving}
                        >
                          <Text className="text-[12px] font-extrabold text-white">Save</Text>
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
