import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useTeacherClasses } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionHeader } from "../../src/components/ui";

export default function TeacherHomework() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const classes = useTeacherClasses();
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
      <Screen refreshing={false} onRefresh={() => classes.refetch()}>
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
      </Screen>
    </SafeAreaView>
  );
}
