import { Text, View } from "react-native";
import { useHomework } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionTitle } from "../../src/components/ui";

export default function Homework() {
  const { data, isLoading, isError, error, refetch, isFetching } = useHomework();
  if (isLoading) return <LoadingView message="Loading homework…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  return (
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <SectionTitle>Homework</SectionTitle>
      {!data.homework.length ? (
        <EmptyView title="No homework" />
      ) : (
        <View className="gap-2">
          {data.homework.map((h: any) => (
            <Card key={h.id}>
              <Text className="font-semibold text-slate-900">{h.title}</Text>
              {!!h.description && <Text className="text-sm text-slate-600">{h.description}</Text>}
              <Text className="mt-1 text-xs text-amber-700">Due {new Date(h.dueDate).toLocaleDateString()}</Text>
            </Card>
          ))}
        </View>
      )}
      <SectionTitle>Assignments</SectionTitle>
      {!data.assignments.length ? (
        <EmptyView title="No assignments" />
      ) : (
        <View className="gap-2">
          {data.assignments.map((a: any) => (
            <Card key={a.id}>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-slate-900">{a.title}</Text>
                <Pill text={a.subject?.name || "General"} tone="slate" />
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
