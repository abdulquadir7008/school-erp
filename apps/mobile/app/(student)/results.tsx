import { Text, View } from "react-native";
import { useResults } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionTitle, statusTone } from "../../src/components/ui";

function grade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
}

export default function Results() {
  const { data, isLoading, isError, error, refetch, isFetching } = useResults();

  if (isLoading) return <LoadingView message="Loading results…" />;
  if (isError || !data) {
    return (
      <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>
    );
  }

  return (
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <SectionTitle>Published report cards</SectionTitle>
      {!data.length ? (
        <EmptyView title="No published results" hint="Results appear here after the school publishes them." />
      ) : (
        <View className="gap-3">
          {data.map((g: any) => (
            <Card key={g.exam.id}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-bold text-slate-900">{g.exam.name}</Text>
                  <Text className="text-xs text-slate-500">{g.exam.type}</Text>
                </View>
                <Pill text={`${g.percentage}% · ${grade(g.percentage)}`} tone={g.percentage >= 40 ? "green" : "red"} />
              </View>
              <Text className="mt-1 text-xs text-slate-500">
                Total {g.totalObtained}/{g.totalMax}
              </Text>
              <View className="mt-2 gap-1.5 border-t border-slate-100 pt-2">
                {g.subjects.map((s: any, i: number) => (
                  <View key={i} className="flex-row items-center justify-between">
                    <Text className="text-sm text-slate-700">{s.subject?.name}</Text>
                    <Pill
                      text={`${s.obtained ?? "—"}/${s.maxMarks}`}
                      tone={statusTone((s.obtained ?? 0) >= s.passMarks ? "PRESENT" : "ABSENT")}
                    />
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
