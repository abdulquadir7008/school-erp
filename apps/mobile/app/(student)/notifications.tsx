import { Text, View } from "react-native";
import { useAnnouncements, useNotifications } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionTitle } from "../../src/components/ui";

export default function Notifications() {
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
    <Screen refreshing={ann.isFetching} onRefresh={() => { ann.refetch(); not.refetch(); }}>
      <SectionTitle>School announcements</SectionTitle>
      {!(ann.data || []).length ? (
        <EmptyView title="No announcements" />
      ) : (
        <View className="gap-2">
          {(ann.data || []).map((a: any) => (
            <Card key={a.id}>
              <Text className="font-semibold text-slate-900">{a.title}</Text>
              <Text className="text-sm text-slate-600">{a.content}</Text>
              <Text className="mt-1 text-xs text-slate-400">
                {new Date(a.publishAt).toLocaleDateString()}
              </Text>
            </Card>
          ))}
        </View>
      )}
      <SectionTitle>My notifications</SectionTitle>
      {!(not.data || []).length ? (
        <EmptyView title="All caught up!" hint="Attendance, homework and fee alerts land here." />
      ) : (
        <View className="gap-2">
          {(not.data || []).map((n: any) => (
            <Card key={n.id} className={n.isRead ? "" : "border-l-4 border-l-primary-500"}>
              <Text className="font-semibold text-slate-900">{n.title}</Text>
              <Text className="text-sm text-slate-600">{n.message}</Text>
              <Text className="mt-1 text-xs text-slate-400">
                {new Date(n.createdAt).toLocaleString()}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
