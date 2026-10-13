import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTeacherClasses } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionHeader } from "../../src/components/ui";

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
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="My classes" subtitle={`${grouped.size} assigned`} />
        {!grouped.size ? (
          <EmptyView title="No classes assigned" hint="Your school office assigns classes and subjects." icon="people-outline" />
        ) : (
          <View className="gap-2.5">
            {Array.from(grouped.entries()).map(([classId, g]) => (
              <Link
                key={classId}
                href={{ pathname: "/(teacher)/students", params: { classId } } as any}
                asChild
              >
                <Pressable>
                  <Card>
                    <View className="flex-row items-center gap-3">
                      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
                        <Ionicons name="people" size={22} color="#0D9488" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[15px] font-extrabold tracking-tight text-ink">{g.class?.name}</Text>
                        <Text className="mt-0.5 text-[12px] text-slate-500" numberOfLines={1}>
                          {Array.from(g.subjects).join(" · ")}
                        </Text>
                        <Text className="mt-1 text-[11px] font-bold text-teal-700">{g.periods} periods / week</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={19} color="#CBD5E1" />
                    </View>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
