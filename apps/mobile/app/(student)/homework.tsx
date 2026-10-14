import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useHomework } from "../../src/api/hooks";
import { mobileApi } from "../../src/api/mobile";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader } from "../../src/components/ui";

type Tab = "ALL" | "PENDING" | "COMPLETED" | "OVERDUE";

const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "COMPLETED", label: "Completed" },
  { key: "OVERDUE", label: "Overdue" },
];

function statusTone(status: string): "green" | "red" | "amber" | "slate" {
  if (status === "COMPLETED") return "green";
  if (status === "OVERDUE" || status === "NOT_SUBMITTED") return "red";
  return "amber";
}

function dueLabel(dueDate: string, isOverdue: boolean): { text: string; color: string } {
  const due = new Date(dueDate);
  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (isOverdue || days < 0) return { text: `Overdue · was due ${due.toLocaleDateString()}`, color: "#DC2626" };
  if (days === 0) return { text: "Due today", color: "#D97706" };
  if (days === 1) return { text: "Due tomorrow", color: "#D97706" };
  if (days <= 3) return { text: `Due in ${days} days · ${due.toLocaleDateString()}`, color: "#D97706" };
  return { text: `Due ${due.toLocaleDateString()}`, color: "#64748B" };
}

function attachmentsOf(h: any): string[] {
  if (Array.isArray(h.attachments)) return h.attachments.filter(Boolean);
  return [];
}

export default function Homework() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch, isFetching } = useHomework();
  const [tab, setTab] = useState<Tab>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const homework = useMemo(() => {
    const list = data?.homework || [];
    if (tab === "ALL") return list;
    if (tab === "COMPLETED") return list.filter((h: any) => h.myStatus === "COMPLETED" || h.completionStatus === "COMPLETED");
    if (tab === "OVERDUE") return list.filter((h: any) => h.myStatus === "OVERDUE" || h.isOverdue);
    return list.filter((h: any) => (h.completionStatus || h.myStatus || "PENDING") === "PENDING" && !h.isOverdue && h.myStatus !== "OVERDUE");
  }, [data, tab]);

  const counts = useMemo(() => {
    const list = data?.homework || [];
    return {
      all: list.length,
      pending: list.filter((h: any) => (h.completionStatus || "PENDING") === "PENDING" && !h.isOverdue && h.myStatus !== "OVERDUE").length,
      completed: list.filter((h: any) => h.myStatus === "COMPLETED" || h.completionStatus === "COMPLETED").length,
      overdue: list.filter((h: any) => h.myStatus === "OVERDUE" || h.isOverdue).length,
    };
  }, [data]);

  const submit = async (h: any) => {
    setBusyId(h.id);
    setNotice(null);
    try {
      await mobileApi.submitHomework(h.id, { submissionText: responseText.trim() || undefined });
      setNotice(`"${h.title}" marked as completed.`);
      setResponseText("");
      setExpanded(null);
      queryClient.invalidateQueries({ queryKey: ["mobile", "homework"] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "student-dashboard"] });
    } catch (e) {
      setNotice(getApiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) return <LoadingView message="Loading homework…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="Homework" subtitle={`${counts.pending} pending · ${counts.overdue} overdue`} />
        <View className="mb-3 flex-row gap-2">
          {TABS.map((t) => {
            const n = t.key === "ALL" ? counts.all : t.key === "PENDING" ? counts.pending : t.key === "COMPLETED" ? counts.completed : counts.overdue;
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                className={`rounded-full px-3.5 py-2 ${active ? "bg-indigo-600" : "bg-slate-100"}`}
              >
                <Text className={`text-[12px] font-bold ${active ? "text-white" : "text-slate-700"}`}>
                  {t.label} · {n}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!!notice && (
          <View className="mb-3 rounded-2xl bg-indigo-50 p-3">
            <Text className="text-[13px] font-semibold text-indigo-900">{notice}</Text>
          </View>
        )}

        {!homework.length ? (
          <EmptyView
            title={tab === "ALL" ? "No homework" : `No ${tab.toLowerCase()} homework`}
            hint={tab === "ALL" ? "You're all caught up." : "Nothing in this view right now."}
            icon="checkmark-done-outline"
          />
        ) : (
          <View className="gap-2.5">
            {homework.map((h: any) => {
              const status = h.myStatus || h.completionStatus || "PENDING";
              const due = dueLabel(h.dueDate, !!h.isOverdue);
              const done = status === "COMPLETED";
              const links = attachmentsOf(h);
              const open = expanded === h.id;
              return (
                <Card key={h.id}>
                  <Pressable onPress={() => { setExpanded(open ? null : h.id); setResponseText(h.submission?.submissionText || ""); }}>
                    <View className="flex-row gap-3">
                      <View className={`h-11 w-11 items-center justify-center rounded-2xl ${done ? "bg-green-50" : "bg-amber-50"}`}>
                        <Ionicons name={done ? "checkmark-done" : "pencil"} size={19} color={done ? "#16A34A" : "#D97706"} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between gap-2">
                          <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={2}>{h.title}</Text>
                          <Pill text={status === "OVERDUE" ? "Overdue" : status === "COMPLETED" ? "Completed" : "Pending"} tone={statusTone(status)} />
                        </View>
                        {!!h.subject?.name && <Text className="mt-0.5 text-[12px] font-semibold text-indigo-700">{h.subject.name}{h.class?.name ? ` · Class ${h.class.name}${h.section?.name ? `-${h.section.name}` : ""}` : ""}</Text>}
                        {!!(h.teacher?.firstName) && <Text className="text-[12px] text-slate-500">{h.teacher.firstName} {h.teacher.lastName}</Text>}
                        {!!h.description && <Text className="mt-0.5 text-[13px] leading-5 text-slate-600" numberOfLines={open ? undefined : 2}>{h.description}</Text>}
                        <View className="mt-2 flex-row items-center gap-1.5">
                          <Ionicons name="alarm-outline" size={13} color={due.color} />
                          <Text className="text-[11px] font-bold" style={{ color: due.color }}>{due.text}</Text>
                        </View>
                        {!!links.length && (
                          <View className="mt-1.5 gap-1">
                            {links.map((u: string) => (
                              <Text key={u} className="text-[12px] text-indigo-600" numberOfLines={1}>Attachment: {u}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                  {open && !done && (
                    <View className="mt-3 border-t border-slate-100 pt-3">
                      <Text className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-400">Your response (optional)</Text>
                      <TextInput
                        className="rounded-2xl bg-slate-50 px-4 py-3 text-[14px] text-ink"
                        value={responseText}
                        onChangeText={setResponseText}
                        placeholder="What did you complete?"
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                      <Pressable
                        className="mt-2 items-center rounded-2xl bg-indigo-600 py-3 active:opacity-85"
                        onPress={() => submit(h)}
                        disabled={busyId === h.id}
                      >
                        <Text className="text-[14px] font-extrabold text-white">
                          {busyId === h.id ? "Submitting…" : "Mark as completed"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                  {open && done && !!h.submission?.submittedAt && (
                    <View className="mt-3 rounded-2xl bg-green-50 p-3">
                      <Text className="text-[13px] font-semibold text-green-900">
                        Completed {new Date(h.submission.submittedAt).toLocaleDateString()}
                        {h.submission?.teacherRemark ? ` · Teacher: ${h.submission.teacherRemark}` : ""}
                      </Text>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        <SectionHeader title="Assignments" subtitle={`${data.assignments.length} assigned`} />
        {!data.assignments.length ? (
          <EmptyView title="No assignments" icon="document-text-outline" />
        ) : (
          <View className="gap-2.5">
            {data.assignments.map((a: any) => (
              <Card key={a.id}>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>{a.title}</Text>
                  <Pill text={a.subject?.name || "General"} tone="violet" />
                </View>
                {!!a.description && <Text className="mt-1 text-[13px] leading-5 text-slate-600">{a.description}</Text>}
                <Text className="mt-1.5 text-[11px] font-bold text-amber-700">
                  Due {new Date(a.dueDate).toLocaleDateString()}{a.totalMarks ? ` · ${a.totalMarks} marks` : ""}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
