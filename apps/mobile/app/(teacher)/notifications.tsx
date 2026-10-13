import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAnnouncements, useNotifications } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionHeader } from "../../src/components/ui";

export default function TeacherNotifications() {
  const ann = useAnnouncements();
  const not = useNotifications();
  if (ann.isLoading || not.isLoading) return <LoadingView message="Loading notices…" />;
  if (ann.isError && not.isError) {
    return (
      <Screen refreshing={false} onRefresh={() => { ann.refetch(); not.refetch(); }}>
        <ErrorView message={getApiErrorMessage(ann.error)} onRetry={() => { ann.refetch(); not.refetch(); }} />
      </Screen>
    );
  }
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={ann.isFetching} onRefresh={() => { ann.refetch(); not.refetch(); }}>
        <SectionHeader title="Announcements" subtitle="From administration" />
        {!(ann.data || []).length ? (
          <EmptyView title="No announcements" icon="megaphone-outline" />
        ) : (
          <View className="gap-2.5">
            {(ann.data || []).map((a: any) => (
              <Card key={a.id}>
                <View className="flex-row gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-teal-50">
                    <Ionicons name="megaphone-outline" size={18} color="#0D9488" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink">{a.title}</Text>
                    <Text className="mt-0.5 text-[13px] leading-5 text-slate-600">{a.content}</Text>
                    <Text className="mt-1 text-[11px] text-slate-400">{new Date(a.publishAt).toLocaleDateString()}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
        <SectionHeader title="My notifications" subtitle="Personal updates" />
        {!(not.data || []).length ? (
          <EmptyView title="All caught up!" icon="checkmark-done-outline" />
        ) : (
          <View className="gap-2.5">
            {(not.data || []).map((n: any) => (
              <Card key={n.id} className={n.isRead ? "" : "border-teal-200 bg-teal-50/40"}>
                <View className="flex-row gap-3">
                  <View className={`h-2.5 w-2.5 rounded-full ${n.isRead ? "bg-slate-200" : "bg-teal-500"} mt-1.5`} />
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink">{n.title}</Text>
                    <Text className="mt-0.5 text-[13px] text-slate-600">{n.message}</Text>
                    <Text className="mt-1 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</Text>
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
