import { Text, View } from "react-native";
import { useLibrary } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionTitle, statusTone } from "../../src/components/ui";

export default function Library() {
  const { data, isLoading, isError, error, refetch, isFetching } = useLibrary();
  if (isLoading) return <LoadingView message="Loading library…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  return (
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <SectionTitle>My issued books</SectionTitle>
      {!data.issued.length ? (
        <EmptyView title="No books issued" hint="Books you borrow will show here with due dates." />
      ) : (
        <View className="gap-2">
          {data.issued.map((i: any) => (
            <Card key={i.id}>
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 font-semibold text-slate-900">{i.book?.title}</Text>
                <Pill text={i.status} tone={statusTone(i.status)} />
              </View>
              <Text className="text-xs text-slate-500">
                {i.book?.author} · Issued {new Date(i.issueDate).toLocaleDateString()} · Due{" "}
                {new Date(i.dueDate).toLocaleDateString()}
              </Text>
              {!!Number(i.fine) && (
                <Text className="text-xs text-red-600">Fine: ₹{Number(i.fine).toLocaleString("en-IN")}</Text>
              )}
            </Card>
          ))}
        </View>
      )}
      <SectionTitle>Browse catalog</SectionTitle>
      {!data.catalog.length ? (
        <EmptyView title="Catalog empty" />
      ) : (
        <View className="gap-2">
          {data.catalog.slice(0, 30).map((b: any) => (
            <Card key={b.id}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-semibold text-slate-900">{b.title}</Text>
                  <Text className="text-xs text-slate-500">
                    {b.author}{b.category ? ` · ${b.category}` : ""}
                  </Text>
                </View>
                <Pill text={b.available > 0 ? `${b.available} left` : "Out"} tone={b.available > 0 ? "green" : "red"} />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
