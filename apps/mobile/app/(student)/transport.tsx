import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTransport } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionHeader } from "../../src/components/ui";

export default function Transport() {
  const { data, isLoading, isError, error, refetch, isFetching } = useTransport();
  if (isLoading) return <LoadingView message="Loading transport…" />;
  if (isError) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  if (!data) {
    return (
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <EmptyView title="No bus assigned" hint="Contact the school office for transport allotment." icon="bus-outline" />
      </Screen>
    );
  }
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="My bus" />
        <View className="overflow-hidden rounded-[24px] bg-ink p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-amber-400">
              <Ionicons name="bus" size={24} color="#0F172A" />
            </View>
            <View className="flex-1">
              <Text className="text-[18px] font-extrabold text-white">{data.vehicle?.registrationNo}</Text>
              <Text className="text-[12px] font-medium text-white/70">{data.vehicle?.type} · {data.route?.name}</Text>
            </View>
          </View>
          {!!data.vehicle?.driver && (
            <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 p-3">
              <Ionicons name="person-circle-outline" size={20} color="#fff" />
              <Text className="flex-1 text-[12px] font-semibold text-white">
                {data.vehicle.driver.name} · {data.vehicle.driver.phone}
              </Text>
            </View>
          )}
          <Text className="mt-3 text-[11px] font-semibold text-white/60">
            {data.route?.startTime || "—"} – {data.route?.endTime || "—"}
          </Text>
        </View>
        {!!data.route?.stops?.length && (
          <>
            <SectionHeader title="Route stops" subtitle={`${data.route.stops.length} stops`} />
            <Card className="p-0">
              <View className="p-2">
                {data.route.stops.map((s: any, i: number) => (
                  <View key={s.id} className="flex-row gap-3 px-2 py-2.5">
                    <View className="items-center">
                      <View className="h-7 w-7 items-center justify-center rounded-full bg-primary-50">
                        <Text className="text-[11px] font-extrabold text-primary-700">{i + 1}</Text>
                      </View>
                      {i < data.route.stops.length - 1 && <View className="mt-1 w-0.5 flex-1 bg-slate-200" style={{ minHeight: 14 }} />}
                    </View>
                    <View className="flex-1 pb-1">
                      <Text className="text-[14px] font-bold text-ink">{s.name}</Text>
                      {!!s.time && <Text className="text-[12px] text-slate-500">{s.time}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
