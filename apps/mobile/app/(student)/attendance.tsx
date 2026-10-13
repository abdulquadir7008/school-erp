import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAttendance } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionTitle, StatCard, statusTone } from "../../src/components/ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => shift(-1)} className="rounded-full bg-white px-4 py-2">
          <Text className="text-base font-bold text-slate-700">‹</Text>
        </Pressable>
        <Text className="text-base font-bold text-slate-900">
          {MONTHS[month - 1]} {year}
        </Text>
        <Pressable onPress={() => shift(1)} className="rounded-full bg-white px-4 py-2">
          <Text className="text-base font-bold text-slate-700">›</Text>
        </Pressable>
      </View>
      <View className="mt-3 flex-row gap-2">
        <StatCard label="Present" value={String(data.summary.present)} />
        <StatCard label="Absent" value={String(data.summary.absent)} />
        <StatCard label="Late" value={String(data.summary.late)} />
        <StatCard label="Score" value={`${data.summary.percentage}%`} />
      </View>

      <SectionTitle>History (read-only)</SectionTitle>
      {!data.records.length ? (
        <EmptyView title="No records yet" hint="Attendance will appear here once marked." />
      ) : (
        <View className="gap-2">
          {data.records.map((r: any) => (
            <Card key={r.id}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="font-semibold text-slate-900">
                    {new Date(r.date).toLocaleDateString("en-IN", {
                      weekday: "short", day: "numeric", month: "short",
                    })}
                  </Text>
                  {!!r.remarks && <Text className="text-xs text-slate-500">{r.remarks}</Text>}
                </View>
                <Pill text={r.status} tone={statusTone(r.status)} />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
