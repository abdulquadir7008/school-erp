import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAttendance } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader, StatCard, statusTone } from "../../src/components/ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
import { useState } from "react";
import { Pressable } from "react-native";

export default function Attendance() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const { data, isLoading, isError, error, refetch, isFetching } = useAttendance(month, year);

  const shift = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  if (isLoading) return <LoadingView message="Loading attendance…" />;
  if (isError || !data) {
    return (
      <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <View className="flex-row items-center justify-between rounded-[20px] border border-slate-100 bg-white p-3">
          <Pressable onPress={() => shift(-1)} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-70">
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </Pressable>
          <View className="items-center">
            <Text className="text-[16px] font-extrabold text-ink">{MONTHS[month - 1]} {year}</Text>
            <Text className="text-[11px] font-semibold text-slate-400">{data.summary.percentage}% present</Text>
          </View>
          <Pressable onPress={() => shift(1)} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-70">
            <Ionicons name="chevron-forward" size={20} color="#0F172A" />
          </Pressable>
        </View>

        <View className="mt-3 flex-row gap-2.5">
          <StatCard label="Present" value={String(data.summary.present)} icon="checkmark-circle-outline" tint="bg-emerald-50" iconColor="#059669" />
          <StatCard label="Absent" value={String(data.summary.absent)} icon="close-circle-outline" tint="bg-red-50" iconColor="#DC2626" />
          <StatCard label="Late" value={String(data.summary.late)} icon="time-outline" tint="bg-amber-50" iconColor="#D97706" />
        </View>

        <SectionHeader title="History" subtitle={`${data.records.length} days recorded`} />
        {!data.records.length ? (
          <EmptyView title="No records yet" hint="Attendance will appear here once marked." icon="calendar-outline" />
        ) : (
          <View className="gap-2.5">
            {data.records.map((r: any) => (
              <Card key={r.id}>
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50">
                    <Text className="text-[15px] font-extrabold text-primary-700">
                      {new Date(r.date).getDate()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink">
                      {new Date(r.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    </Text>
                    {!!r.remarks && <Text className="text-[12px] text-slate-500">{r.remarks}</Text>}
                  </View>
                  <Pill text={r.status} tone={statusTone(r.status)} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
