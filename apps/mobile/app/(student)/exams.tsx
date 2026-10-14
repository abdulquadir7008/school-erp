import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useExams } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader, statusTone } from "../../src/components/ui";

type Tab = "UPCOMING" | "TODAY" | "COMPLETED" | "RESULTS_PUBLISHED";

const TABS: { key: Tab; label: string }[] = [
  { key: "UPCOMING", label: "Upcoming" },
  { key: "TODAY", label: "Today" },
  { key: "COMPLETED", label: "Completed" },
  { key: "RESULTS_PUBLISHED", label: "Results" },
];

export default function Exams() {
  const { data, isLoading, isError, error, refetch, isFetching } = useExams();
  const [tab, setTab] = useState<Tab>("UPCOMING");
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(() => {
    const list = data || [];
    const c: Record<Tab, number> = { UPCOMING: 0, TODAY: 0, COMPLETED: 0, RESULTS_PUBLISHED: 0 };
    for (const e of list) {
      const b = (e.bucket || "UPCOMING") as Tab;
      if (c[b] !== undefined) c[b] += 1;
    }
    return c;
  }, [data]);

  const visible = useMemo(() => (data || []).filter((e: any) => (e.bucket || "UPCOMING") === tab), [data, tab]);

  if (isLoading) return <LoadingView message="Loading exams…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="Examinations" subtitle={`${data.length} scheduled for you`} />
        <View className="mb-3 flex-row flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} className={`rounded-full px-3.5 py-2 ${active ? "bg-indigo-600" : "bg-slate-100"}`}>
                <Text className={`text-[12px] font-bold ${active ? "text-white" : "text-slate-700"}`}>{t.label} · {counts[t.key]}</Text>
              </Pressable>
            );
          })}
        </View>
        {!visible.length ? (
          <EmptyView
            title={tab === "UPCOMING" ? "No upcoming exams" : tab === "TODAY" ? "Nothing today" : tab === "COMPLETED" ? "No completed exams" : "No published results"}
            hint={tab === "RESULTS_PUBLISHED" ? "Published report cards appear under Results." : "Schedules will appear here."}
            icon="document-text-outline"
          />
        ) : (
          <View className="gap-2.5">
            {visible.map((e: any) => {
              const open = expanded === e.id;
              return (
                <Card key={e.id}>
                  <Pressable onPress={() => setExpanded(open ? null : e.id)}>
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-[15px] font-extrabold tracking-tight text-ink">{e.name}</Text>
                        <Text className="mt-0.5 text-[12px] text-slate-500">
                          {e.type} · {e.startLocal || new Date(e.startDate).toLocaleDateString()} – {e.endLocal || new Date(e.endDate).toLocaleDateString()}
                        </Text>
                        <Text className="mt-0.5 text-[11px] text-slate-400">
                          {e.subjectCount ?? e.subjects?.length ?? 0} subjects{e.timezone ? ` · ${e.timezone}` : ""}
                        </Text>
                      </View>
                      <Pill text={e.status} tone={statusTone(e.status)} />
                    </View>
                  </Pressable>
                  {open && (
                    <View className="mt-3 gap-2 border-t border-slate-100 pt-3">
                      {!!e.instructions && (
                        <View className="rounded-2xl bg-slate-50 p-3">
                          <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Instructions</Text>
                          <Text className="mt-1 text-[13px] leading-5 text-slate-700">{e.instructions}</Text>
                        </View>
                      )}
                      {(e.subjects || []).map((s: any) => (
                        <View key={s.id} className="flex-row items-center gap-2.5">
                          <View className="h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                            <Ionicons name="book-outline" size={16} color="#4F46E5" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[13px] font-bold text-ink">{s.subject?.name}</Text>
                            <Text className="text-[11px] text-slate-500">
                              {s.date ? new Date(s.date).toLocaleDateString() : "Date TBA"}
                              {s.startTime ? ` · ${s.startTime}${s.endTime ? `–${s.endTime}` : ""}` : ""}
                              {s.room ? ` · ${s.room}` : ""}
                            </Text>
                            {!!s.invigilator && (
                              <Text className="text-[11px] text-slate-400">
                                Invigilator: {s.invigilator.firstName} {s.invigilator.lastName}
                              </Text>
                            )}
                          </View>
                          {!!s.maxMarks && <Text className="text-[11px] font-bold text-slate-500">{s.maxMarks} m</Text>}
                        </View>
                      ))}
                      {tab === "RESULTS_PUBLISHED" && (
                        <Link href="/(student)/results" asChild>
                          <Pressable className="mt-1 items-center rounded-2xl bg-indigo-600 py-3 active:opacity-85">
                            <Text className="text-[13px] font-extrabold text-white">View my result</Text>
                          </Pressable>
                        </Link>
                      )}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
