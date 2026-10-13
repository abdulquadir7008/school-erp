import { Text, View } from "react-native";
import { useExams } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionTitle, statusTone } from "../../src/components/ui";

export default function Exams() {
  const { data, isLoading, isError, error, refetch, isFetching } = useExams();
  if (isLoading) return <LoadingView message="Loading exams…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  return (
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <SectionTitle>Upcoming &amp; published examinations</SectionTitle>
      {!data.length ? (
        <EmptyView title="No examinations" hint="Schedules will appear here." />
      ) : (
        <View className="gap-2">
          {data.map((e: any) => (
            <Card key={e.id}>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-slate-900">{e.name}</Text>
                <Pill text={e.status} tone={statusTone(e.status)} />
              </View>
              <Text className="text-xs text-slate-500">
                {e.type} · {new Date(e.startDate).toLocaleDateString()} –{" "}
                {new Date(e.endDate).toLocaleDateString()}
              </Text>
              {!!e.subjects?.length && (
                <View className="mt-2 gap-1 border-t border-slate-100 pt-2">
                  {e.subjects.map((s: any) => (
                    <Text key={s.id} className="text-sm text-slate-600">
                      • {s.subject?.name}
                      {s.date ? ` — ${new Date(s.date).toLocaleDateString()}` : ""}
                      {s.startTime ? ` (${s.startTime})` : ""}
                    </Text>
                  ))}
                </View>
              )}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
