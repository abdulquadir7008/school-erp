import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { useReportCard, useResults } from "../../src/api/hooks";
import { mobileApi } from "../../src/api/mobile";
import { getApiErrorMessage } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { Card, EmptyView, ErrorView, LoadingView, Pill, ProgressBar, Screen, SectionHeader, statusTone } from "../../src/components/ui";

function grade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
}

function ReportCardDetail({ examId, admissionNumber }: { examId: string; admissionNumber: string }) {
  const card = useReportCard(examId);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const uri = await mobileApi.downloadReportCard(examId, admissionNumber);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else setMsg(`Saved to ${uri}`);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (card.isLoading) return <LoadingView message="Loading report card…" />;
  if (card.isError || !card.data) {
    return <ErrorView message={getApiErrorMessage(card.error)} onRetry={() => card.refetch()} />;
  }
  const r = card.data;
  return (
    <View className="mt-3 gap-2 border-t border-slate-100 pt-3">
      <View className="flex-row gap-2">
        <View className="flex-1 items-center rounded-2xl bg-slate-50 py-2.5">
          <Text className="text-[11px] font-bold uppercase text-slate-400">Total</Text>
          <Text className="text-[14px] font-extrabold text-ink">{r.totalObtained}/{r.totalMax}</Text>
        </View>
        <View className="flex-1 items-center rounded-2xl bg-slate-50 py-2.5">
          <Text className="text-[11px] font-bold uppercase text-slate-400">Grade</Text>
          <Text className="text-[14px] font-extrabold text-ink">{r.grade}</Text>
        </View>
        {r.rank != null && (
          <View className="flex-1 items-center rounded-2xl bg-amber-50 py-2.5">
            <Text className="text-[11px] font-bold uppercase text-amber-600">Rank</Text>
            <Text className="text-[14px] font-extrabold text-amber-800">{r.rank}</Text>
          </View>
        )}
      </View>
      {r.subjects.map((s: any, i: number) => (
        <View key={i} className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-slate-700" numberOfLines={1}>
              {s.subject?.name}
              {s.isAbsent ? " · Absent" : ""}{s.isExempt ? " · Exempt" : ""}
            </Text>
            {!!s.remarks && <Text className="text-[11px] italic text-slate-500" numberOfLines={2}>{s.remarks}</Text>}
          </View>
          <Pill text={`${s.obtained ?? "—"}/${s.maxMarks}`} tone={statusTone((s.obtained ?? 0) >= s.passMarks && !s.isAbsent ? "PRESENT" : "ABSENT")} />
        </View>
      ))}
      {r.attendancePercentage != null && (
        <Text className="text-[12px] text-slate-500">Exam-period attendance: {r.attendancePercentage}%</Text>
      )}
      {!!msg && <Text className="text-[12px] font-semibold text-indigo-700">{msg}</Text>}
      <Pressable className="mt-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-ink py-3 active:opacity-85" onPress={download} disabled={busy}>
        <Ionicons name="download-outline" size={16} color="#FFFFFF" />
        <Text className="text-[13px] font-extrabold text-white">{busy ? "Preparing…" : "Download report card (PDF)"}</Text>
      </Pressable>
    </View>
  );
}

export default function Results() {
  const { data, isLoading, isError, error, refetch, isFetching } = useResults();
  const admissionNumber = useAuthStore((s) => (s.user as any)?.student?.admissionNumber || (s.user as any)?.admissionNumber || "report");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <LoadingView message="Loading results…" />;
  if (isError || !data) {
    return (
      <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <SectionHeader title="Report cards" subtitle={`${data.length} published`} />
        {!data.length ? (
          <EmptyView title="No published results" hint="Results appear here after the school publishes them." icon="trophy-outline" />
        ) : (
          <View className="gap-3">
            {data.map((g: any) => {
              const open = expanded === g.exam.id;
              return (
                <Card key={g.exam.id}>
                  <Pressable onPress={() => setExpanded(open ? null : g.exam.id)}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-[15px] font-extrabold tracking-tight text-ink">{g.exam.name}</Text>
                        <Text className="text-[12px] text-slate-500">{g.exam.type} · Total {g.totalObtained}/{g.totalMax}</Text>
                      </View>
                      <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: g.percentage >= 40 ? "#DCFCE7" : "#FEE2E2" }}>
                        <Text className="text-[14px] font-extrabold" style={{ color: g.percentage >= 40 ? "#15803D" : "#DC2626" }}>{grade(g.percentage)}</Text>
                      </View>
                    </View>
                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="text-[12px] font-bold text-ink">{g.percentage}%</Text>
                      <Pill text={g.percentage >= 40 ? "Passed" : "Needs work"} tone={g.percentage >= 40 ? "green" : "red"} />
                    </View>
                    <ProgressBar value={g.totalObtained} total={g.totalMax} color={g.percentage >= 40 ? "#16A34A" : "#DC2626"} />
                  </Pressable>
                  {open && <ReportCardDetail examId={g.exam.id} admissionNumber={admissionNumber} />}
                </Card>
              );
            })}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
