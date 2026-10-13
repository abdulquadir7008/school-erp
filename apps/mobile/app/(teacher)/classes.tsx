import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { useTeacherClasses } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionTitle } from "../../src/components/ui";

export default function Classes() {
  const { data, isLoading, isError, error, refetch, isFetching } = useTeacherClasses();
  if (isLoading) return <LoadingView message="Loading classes…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }

  const grouped = new Map<string, { class: any; subjects: Set<string>; periods: number }>();
  for (const e of data) {
    const key = e.classId;
    if (!grouped.has(key)) {
      grouped.set(key, { class: e.class, subjects: new Set(), periods: 0 });
    }
    const g = grouped.get(key)!;
    g.subjects.add(e.subject?.name || "—");
    g.periods += 1;
  }

  return (
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <SectionTitle>My assigned classes</SectionTitle>
      {!grouped.size ? (
        <EmptyView title="No classes assigned" hint="Your school office assigns classes and subjects." />
      ) : (
        <View className="gap-2">
          {Array.from(grouped.entries()).map(([classId, g]) => (
            <Link
              key={classId}
              href={{ pathname: "/(teacher)/students", params: { classId } } as any}
              asChild
            >
              <Pressable>
                <Card>
                  <Text className="text-base font-bold text-slate-900">{g.class?.name}</Text>
                  <Text className="text-xs text-slate-500">
                    {Array.from(g.subjects).join(", ")} · {g.periods} periods/week
                  </Text>
                  <Text className="mt-1 text-xs font-semibold text-primary-600">
                    View students →
                  </Text>
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>
      )}
    </Screen>
  );
}
