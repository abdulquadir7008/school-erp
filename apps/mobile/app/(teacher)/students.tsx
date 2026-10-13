import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTeacherStudents } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionTitle } from "../../src/components/ui";

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
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <SectionTitle>
        Students {data.length ? `(${data.length})` : ""}
      </SectionTitle>
      {!data.length ? (
        <EmptyView title="No students" hint="Pick an assigned class to see its roster." />
      ) : (
        <View className="gap-2">
          {data.map((s: any) => (
            <Card key={s.id}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                    <Text className="font-bold text-primary-700">
                      {s.firstName?.[0]}{s.lastName?.[0]}
                    </Text>
                  </View>
                  <View>
                    <Text className="font-semibold text-slate-900">
                      {s.firstName} {s.lastName}
                    </Text>
                    <Text className="text-xs text-slate-500">
                      {s.admissionNumber}
                      {s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}
                      {s.section?.name ? ` · Sec ${s.section.name}` : ""}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
