import { Text, View } from "react-native";
import { useTimetable } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionTitle } from "../../src/components/ui";

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
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <SectionTitle>My weekly timetable</SectionTitle>
      {!data.length ? (
        <EmptyView title="No timetable" />
      ) : (
        <View className="gap-3">
          {Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]).map(([day, list]) => (
            <View key={day}>
              <Text className="mb-1 text-sm font-bold text-primary-700">{DAYS[day] || `Day ${day}`}</Text>
              <View className="gap-2">
                {list.map((t: any) => (
                  <Card key={t.id}>
                    <Text className="font-semibold text-slate-900">
                      {t.class?.name} · {t.subject?.name}
                    </Text>
                    <Text className="text-xs text-slate-500">
                      {t.startTime} – {t.endTime}{t.room ? ` · Room ${t.room}` : ""}
                    </Text>
                  </Card>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
