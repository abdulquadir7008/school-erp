import { Text, View } from "react-native";
import { useTransport } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Screen, SectionTitle } from "../../src/components/ui";

export default function Transport() {
  const { data, isLoading, isError, error, refetch, isFetching } = useTransport();
  if (isLoading) return <LoadingView message="Loading transport…" />;
  if (isError) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  if (!data) {
    return (
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <EmptyView title="No bus assigned" hint="Contact the school office for transport allotment." />
      </Screen>
    );
  }
  return (
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <SectionTitle>My bus</SectionTitle>
      <Card className="bg-sidebar">
        <Text className="text-lg font-bold text-white">{data.vehicle?.registrationNo}</Text>
        <Text className="text-sm text-slate-300">
          {data.vehicle?.type} · Route: {data.route?.name}
        </Text>
        {!!data.vehicle?.driver && (
          <Text className="mt-1 text-xs text-slate-400">
            Driver {data.vehicle.driver.name} · {data.vehicle.driver.phone}
          </Text>
        )}
      </Card>
      {!!data.route?.stops?.length && (
        <>
          <SectionTitle>Route stops</SectionTitle>
          <View className="gap-2">
            {data.route.stops.map((s: any) => (
              <Card key={s.id}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-slate-900">{s.name}</Text>
                  {!!s.time && <Text className="text-xs text-slate-500">{s.time}</Text>}
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
      <Card className="mt-3">
        <Text className="text-xs text-slate-500">
          Timings {data.route?.startTime || "—"} – {data.route?.endTime || "—"}
        </Text>
      </Card>
    </Screen>
  );
}
