import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useTeacherClasses } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionTitle } from "../../src/components/ui";

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

  // Unique class × subject pairs from the teacher's timetable entries.
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
      setMsg(`${kind === "homework" ? "Homework" : "Assignment"} published to ${selected.className} · ${selected.subjectName} ✓`);
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
    <Screen refreshing={false} onRefresh={() => classes.refetch()}>
      <SectionTitle>Create homework / assignment</SectionTitle>
      {!targets.length ? (
        <EmptyView title="No classes assigned" hint="Your timetable has no class/subject entries yet." />
      ) : (
      <Card>
        <Text className="text-xs font-medium text-slate-500">Post to class × subject</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {targets.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTargetKey(t.key)}
              className={`rounded-full px-3 py-2 ${selected?.key === t.key ? "bg-primary-600" : "bg-slate-100"}`}
            >
              <Text className={`text-xs font-semibold ${selected?.key === t.key ? "text-white" : "text-slate-700"}`}>
                {t.className} · {t.subjectName}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="mb-1 mt-3 text-xs font-medium text-slate-500">Title</Text>
        <TextInput className="rounded-xl border border-slate-200 px-3 py-2.5" value={title} onChangeText={setTitle} placeholder="e.g. Chapter 5 exercises" />
        <Text className="mb-1 mt-3 text-xs font-medium text-slate-500">Instructions</Text>
        <TextInput
          className="rounded-xl border border-slate-200 px-3 py-2.5"
          value={description} onChangeText={setDescription} placeholder="Details for students…"
          multiline numberOfLines={3} textAlignVertical="top"
        />
        <Text className="mb-1 mt-3 text-xs font-medium text-slate-500">Due date (YYYY-MM-DD)</Text>
        <TextInput className="rounded-xl border border-slate-200 px-3 py-2.5" value={dueDate} onChangeText={setDueDate} placeholder="2026-10-20" />
        {!!msg && <Text className="mt-2 text-sm text-slate-600">{msg}</Text>}
        <View className="mt-3 flex-row gap-2">
          <Pressable className="flex-1 items-center rounded-xl bg-primary-600 py-3" onPress={() => submit("homework")} disabled={busy}>
            <Text className="font-bold text-white">Post homework</Text>
          </Pressable>
          <Pressable className="flex-1 items-center rounded-xl bg-sidebar py-3" onPress={() => submit("assignment")} disabled={busy}>
            <Text className="font-bold text-white">Post assignment</Text>
          </Pressable>
        </View>
      </Card>
      )}
    </Screen>
  );
}
