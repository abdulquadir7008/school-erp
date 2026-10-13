import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useExams } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader, statusTone } from "../../src/components/ui";

export default function Exams() {
  const { data, isLoading, isError, error, refetch, isFetching } = useExams();
  if (isLoading) return <LoadingView message="Loading exams…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="Examinations" subtitle={`${data.length} scheduled`} />
        {!data.length ? (
          <EmptyView title="No examinations" hint="Schedules will appear here." icon="document-text-outline" />
        ) : (
          <View className="gap-2.5">
            {data.map((e: any) => (
              <Card key={e.id}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-[15px] font-extrabold tracking-tight text-ink">{e.name}</Text>
                    <Text className="mt-0.5 text-[12px] text-slate-500">
                      {e.type} · {new Date(e.startDate).toLocaleDateString()} – {new Date(e.endDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pill text={e.status} tone={statusTone(e.status)} />
                </View>
                {!!e.subjects?.length && (
                  <View className="mt-3 gap-2 border-t border-slate-100 pt-3">
                    {e.subjects.map((s: any) => (
                      <View key={s.id} className="flex-row items-center gap-2.5">
                        <View className="h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                          <Ionicons name="book-outline" size={16} color="#4F46E5" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[13px] font-bold text-ink">{s.subject?.name}</Text>
                          <Text className="text-[11px] text-slate-500">
                            {s.date ? new Date(s.date).toLocaleDateString() : "Date TBA"}{s.startTime ? ` · ${s.startTime}` : ""}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
