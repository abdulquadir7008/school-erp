import { Text, View } from "react-native";
import { useTimetable, useHomework } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionTitle } from "../../src/components/ui";

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
    <Screen refreshing={tt.isFetching} onRefresh={() => { tt.refetch(); hw.refetch(); }}>
      <SectionTitle>Timetable</SectionTitle>
      {!entries.length ? (
        <EmptyView title="No timetable yet" hint="Your school will publish it soon." />
      ) : (
        <View className="gap-3">
          {Array.from(byDay.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([day, list]) => (
              <View key={day}>
                <Text className="mb-1 text-sm font-bold text-primary-700">{DAYS[day] || `Day ${day}`}</Text>
                <View className="gap-2">
                  {list.map((t: any) => (
                    <Card key={t.id}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="font-semibold text-slate-900">{t.subject?.name}</Text>
                          <Text className="text-xs text-slate-500">
                            {t.teacher ? `${t.teacher.firstName} ${t.teacher.lastName} · ` : ""}
                            {t.startTime} – {t.endTime}{t.room ? ` · ${t.room}` : ""}
                          </Text>
                        </View>
                        <Pill text={t.startTime} tone="blue" />
                      </View>
                    </Card>
                  ))}
                </View>
              </View>
            ))}
        </View>
      )}

      <SectionTitle>Homework &amp; assignments</SectionTitle>
      {hw.isError ? (
        <ErrorView message={getApiErrorMessage(hw.error)} onRetry={() => hw.refetch()} />
      ) : !(hw.data?.homework?.length || hw.data?.assignments?.length) ? (
        <EmptyView title="All clear!" hint="No homework or assignments right now." />
      ) : (
        <View className="gap-2">
          {(hw.data?.homework || []).map((h: any) => (
            <Card key={h.id}>
              <Text className="font-semibold text-slate-900">{h.title}</Text>
              {!!h.description && <Text className="text-sm text-slate-600">{h.description}</Text>}
              <Text className="mt-1 text-xs text-amber-700">Due {new Date(h.dueDate).toLocaleDateString()}</Text>
            </Card>
          ))}
          {(hw.data?.assignments || []).map((a: any) => (
            <Card key={a.id}>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-slate-900">{a.title}</Text>
                <Pill text={a.subject?.name || "Assignment"} tone="slate" />
              </View>
              {!!a.description && <Text className="text-sm text-slate-600">{a.description}</Text>}
              <Text className="mt-1 text-xs text-amber-700">
                Due {new Date(a.dueDate).toLocaleDateString()}
                {a.totalMarks ? ` · ${a.totalMarks} marks` : ""}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
