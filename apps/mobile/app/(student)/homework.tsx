import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHomework } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader } from "../../src/components/ui";

export default function Homework() {
  const { data, isLoading, isError, error, refetch, isFetching } = useHomework();
  if (isLoading) return <LoadingView message="Loading homework…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="Homework" subtitle={`${data.homework.length} tasks`} />
        {!data.homework.length ? (
          <EmptyView title="No homework" hint="You're all caught up." icon="checkmark-done-outline" />
        ) : (
          <View className="gap-2.5">
            {data.homework.map((h: any) => (
              <Card key={h.id}>
                <View className="flex-row gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
                    <Ionicons name="pencil" size={19} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink">{h.title}</Text>
                    {!!h.description && <Text className="mt-0.5 text-[13px] leading-5 text-slate-600">{h.description}</Text>}
                    <View className="mt-2 flex-row items-center gap-1.5">
                      <Ionicons name="alarm-outline" size={13} color="#D97706" />
                      <Text className="text-[11px] font-bold text-amber-700">Due {new Date(h.dueDate).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
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
