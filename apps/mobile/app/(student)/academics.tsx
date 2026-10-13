import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTimetable, useHomework } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader } from "../../src/components/ui";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Academics() {
  const tt = useTimetable();
  const hw = useHomework();

  if (tt.isLoading || hw.isLoading) return <LoadingView message="Loading academics…" />;
  if (tt.isError && hw.isError) {
    return (
      <Screen><ErrorView message={getApiErrorMessage(tt.error)} onRetry={() => { tt.refetch(); hw.refetch(); }} /></Screen>
    );
  }
  if (tt.isError) {
    return (
      <Screen><ErrorView message={getApiErrorMessage(tt.error)} onRetry={() => tt.refetch()} /></Screen>
    );
  }

  const entries = tt.data || [];
  const byDay = new Map<number, typeof entries>();
  for (const e of entries) {
    if (!byDay.has(e.dayOfWeek)) byDay.set(e.dayOfWeek, []);
    byDay.get(e.dayOfWeek)!.push(e);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={tt.isFetching} onRefresh={() => { tt.refetch(); hw.refetch(); }}>
        <SectionHeader title="Timetable" subtitle={`${entries.length} periods / week`} />
        {!entries.length ? (
          <EmptyView title="No timetable yet" hint="Your school will publish it soon." icon="calendar-outline" />
        ) : (
          <View className="gap-3">
            {Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]).map(([day, list]) => (
              <View key={day}>
                <View className="mb-1.5 flex-row items-center gap-2">
                  <View className="rounded-full bg-primary-600 px-3 py-1">
                    <Text className="text-[11px] font-extrabold uppercase tracking-wide text-white">{DAYS[day] || `Day ${day}`}</Text>
                  </View>
                  <Text className="text-[11px] font-semibold text-slate-400">{list.length} periods</Text>
                </View>
                <View className="gap-2">
                  {list.map((t: any) => (
                    <Card key={t.id}>
                      <View className="flex-row items-center gap-3">
                        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50">
                          <Ionicons name="book-outline" size={19} color="#4F46E5" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[14px] font-bold text-ink">{t.subject?.name}</Text>
                          <Text className="mt-0.5 text-[12px] text-slate-500">
                            {t.teacher ? `${t.teacher.firstName} ${t.teacher.lastName} · ` : ""}
                            {t.startTime} – {t.endTime}{t.room ? ` · ${t.room}` : ""}
                          </Text>
                        </View>
                        <Pill text={t.startTime} tone="violet" />
                      </View>
                    </Card>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <SectionHeader title="Homework & assignments" subtitle={`${(hw.data?.homework?.length ?? 0) + (hw.data?.assignments?.length ?? 0)} open`} />
        {hw.isError ? (
          <ErrorView message={getApiErrorMessage(hw.error)} onRetry={() => hw.refetch()} />
        ) : !(hw.data?.homework?.length || hw.data?.assignments?.length) ? (
          <EmptyView title="All clear!" hint="No homework or assignments right now." icon="checkmark-done-outline" />
        ) : (
          <View className="gap-2.5">
            {(hw.data?.homework || []).map((h: any) => (
              <Card key={h.id}>
                <View className="flex-row gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-amber-50">
                    <Ionicons name="pencil-outline" size={18} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink">{h.title}</Text>
                    {!!h.description && <Text className="mt-0.5 text-[13px] text-slate-600" numberOfLines={2}>{h.description}</Text>}
                    <Text className="mt-1 text-[11px] font-bold text-amber-700">Due {new Date(h.dueDate).toLocaleDateString()}</Text>
                  </View>
                </View>
              </Card>
            ))}
            {(hw.data?.assignments || []).map((a: any) => (
              <Card key={a.id}>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>{a.title}</Text>
                  <Pill text={a.subject?.name || "Assignment"} tone="slate" />
                </View>
                {!!a.description && <Text className="mt-1 text-[13px] text-slate-600" numberOfLines={2}>{a.description}</Text>}
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
