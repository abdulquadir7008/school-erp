import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLibrary } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader, statusTone } from "../../src/components/ui";

export default function Library() {
  const { data, isLoading, isError, error, refetch, isFetching } = useLibrary();
  if (isLoading) return <LoadingView message="Loading library…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="My books" subtitle={`${data.issued.length} issued`} />
        {!data.issued.length ? (
          <EmptyView title="No books issued" hint="Books you borrow will show here with due dates." icon="library-outline" />
        ) : (
          <View className="gap-2.5">
            {data.issued.map((i: any) => (
              <Card key={i.id}>
                <View className="flex-row gap-3">
                  <View className="h-12 w-10 items-center justify-center rounded-xl bg-primary-600">
                    <Ionicons name="book" size={20} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>{i.book?.title}</Text>
                      <Pill text={i.status} tone={statusTone(i.status)} />
                    </View>
                    <Text className="mt-0.5 text-[12px] text-slate-500">
                      {i.book?.author} · Due {new Date(i.dueDate).toLocaleDateString()}
                    </Text>
                    {!!Number(i.fine) && (
                      <Text className="mt-0.5 text-[12px] font-bold text-red-600">Fine: ₹{Number(i.fine).toLocaleString("en-IN")}</Text>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
        <SectionHeader title="Browse catalog" subtitle={`${data.catalog.length} titles`} />
        {!data.catalog.length ? (
          <EmptyView title="Catalog empty" icon="search-outline" />
        ) : (
          <View className="gap-2.5">
            {data.catalog.slice(0, 30).map((b: any) => (
              <Card key={b.id}>
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-sky-50">
                    <Ionicons name="library-outline" size={18} color="#0284C7" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink" numberOfLines={1}>{b.title}</Text>
                    <Text className="text-[12px] text-slate-500" numberOfLines={1}>{b.author}{b.category ? ` · ${b.category}` : ""}</Text>
                  </View>
                  <Pill text={b.available > 0 ? `${b.available} left` : "Out"} tone={b.available > 0 ? "green" : "red"} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
