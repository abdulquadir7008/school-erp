import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTimetable } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionHeader } from "../../src/components/ui";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function TeacherTimetable() {
  const { data, isLoading, isError, error, refetch, isFetching } = useTimetable();
  if (isLoading) return <LoadingView message="Loading timetable…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  const byDay = new Map<number, typeof data>();
  for (const e of data) {
    if (!byDay.has(e.dayOfWeek)) byDay.set(e.dayOfWeek, []);
    byDay.get(e.dayOfWeek)!.push(e);
  }
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="Weekly timetable" subtitle={`${data.length} periods`} />
        {!data.length ? (
          <EmptyView title="No timetable" icon="calendar-outline" />
        ) : (
          <View className="gap-3">
            {Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]).map(([day, list]) => (
              <View key={day}>
                <View className="mb-1.5 flex-row items-center gap-2">
                  <View className="rounded-full bg-tealbrand-600 px-3 py-1">
                    <Text className="text-[11px] font-extrabold uppercase tracking-wide text-white">{DAYS[day] || `Day ${day}`}</Text>
                  </View>
                  <Text className="text-[11px] font-semibold text-slate-400">{list.length} periods</Text>
                </View>
                <View className="gap-2">
                  {list.map((t: any) => (
                    <Card key={t.id}>
                      <View className="flex-row items-center gap-3">
                        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-teal-50">
                          <Ionicons name="time-outline" size={19} color="#0D9488" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[14px] font-bold text-ink">{t.class?.name} · {t.subject?.name}</Text>
                          <Text className="mt-0.5 text-[12px] text-slate-500">{t.startTime} – {t.endTime}{t.room ? ` · Room ${t.room}` : ""}</Text>
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
