import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTeacherStudents } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Avatar, Card, EmptyView, ErrorView, LoadingView, Screen, SectionHeader } from "../../src/components/ui";

export default function TeacherStudents() {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const { data, isLoading, isError, error, refetch, isFetching } = useTeacherStudents(
    typeof classId === "string" ? classId : undefined
  );

  if (isLoading) return <LoadingView message="Loading students…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="Students" subtitle={data.length ? `${data.length} in roster` : "Pick a class"} />
        {!data.length ? (
          <EmptyView title="No students" hint="Pick an assigned class to see its roster." icon="people-outline" />
        ) : (
          <View className="gap-2.5">
            {data.map((s: any) => (
              <Card key={s.id}>
                <View className="flex-row items-center gap-3">
                  <Avatar name={`${s.firstName} ${s.lastName}`} size={42} bg="#0D9488" />
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink">{s.firstName} {s.lastName}</Text>
                    <Text className="mt-0.5 text-[12px] text-slate-500">
                      {s.admissionNumber}{s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}{s.section?.name ? ` · Sec ${s.section.name}` : ""}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
