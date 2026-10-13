import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useResults } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, ProgressBar, Screen, SectionHeader, statusTone } from "../../src/components/ui";

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
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="Report cards" subtitle={`${data.length} published`} />
        {!data.length ? (
          <EmptyView title="No published results" hint="Results appear here after the school publishes them." icon="trophy-outline" />
        ) : (
          <View className="gap-3">
            {data.map((g: any) => (
              <Card key={g.exam.id}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-[15px] font-extrabold tracking-tight text-ink">{g.exam.name}</Text>
                    <Text className="text-[12px] text-slate-500">{g.exam.type} · Total {g.totalObtained}/{g.totalMax}</Text>
                  </View>
                  <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: g.percentage >= 40 ? "#DCFCE7" : "#FEE2E2" }}>
                    <Text className="text-[14px] font-extrabold" style={{ color: g.percentage >= 40 ? "#15803D" : "#DC2626" }}>{grade(g.percentage)}</Text>
                  </View>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-[12px] font-bold text-ink">{g.percentage}%</Text>
                  <Pill text={g.percentage >= 40 ? "Passed" : "Needs work"} tone={g.percentage >= 40 ? "green" : "red"} />
                </View>
                <ProgressBar value={g.totalObtained} total={g.totalMax} color={g.percentage >= 40 ? "#16A34A" : "#DC2626"} />
                <View className="mt-3 gap-2 border-t border-slate-100 pt-3">
                  {g.subjects.map((s: any, i: number) => (
                    <View key={i} className="flex-row items-center justify-between">
                      <Text className="flex-1 text-[13px] font-semibold text-slate-700" numberOfLines={1}>{s.subject?.name}</Text>
                      <Pill text={`${s.obtained ?? "—"}/${s.maxMarks}`} tone={statusTone((s.obtained ?? 0) >= s.passMarks ? "PRESENT" : "ABSENT")} />
                    </View>
                  ))}
                </View>
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
