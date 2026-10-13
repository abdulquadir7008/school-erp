import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStudentDashboard } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import {
  Avatar,
  Card,
  EmptyView,
  ErrorView,
  HeroCard,
  Pill,
  ProgressBar,
  QuickAction,
  Screen,
  SectionHeader,
  SkeletonList,
  StatCard,
  greeting,
  statusTone,
} from "../../src/components/ui";
import { useAuthStore } from "../../src/store/auth";

export default function StudentHome() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, isError, error, refetch } = useStudentDashboard();

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["mobile"] });
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <SkeletonList rows={4} />
      </SafeAreaView>
    );
  }
  if (isError || !data) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <Screen refreshing={refreshing} onRefresh={onRefresh}>
          <ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} />
        </Screen>
      </SafeAreaView>
    );
  }

  const s = data.student;
  const fullName = `${s.firstName} ${s.lastName}`;
  const feesDue = (data.feesDue || []).reduce(
    (sum: number, i: any) => sum + Number(i.totalAmount) - Number(i.paidAmount),
    0
  );
  const pct = data.attendancePercentage ?? 0;
  const unread = (data.announcements || []).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        {/* Top bar */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Avatar name={fullName} size={44} bg="#4F46E5" />
            <View>
              <Text className="text-[12px] font-semibold text-slate-400">
                {greeting()}, 👋
              </Text>
              <Text className="text-[16px] font-extrabold tracking-tight text-ink">{s.firstName}</Text>
            </View>
          </View>
          <Link href="/(student)/notifications" asChild>
            <Pressable className="relative h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white">
              <Ionicons name="notifications-outline" size={20} color="#0F172A" />
              {unread > 0 && (
                <View className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
              )}
            </Pressable>
          </Link>
        </View>

        {/* Hero */}
        <View className="mt-4">
          <HeroCard
            eyebrow={`${s.class?.name ?? "Student"}${s.section?.name ? ` · Sec ${s.section.name}` : ""}`}
            title={fullName}
            subtitle={s.school?.name ?? user?.school?.name ?? ""}
            meta={`Adm ${s.admissionNumber}`}
            deep="#1E1B4B"
            accent="#818CF8"
          >
            <View className="flex-row items-center gap-2">
              <View className="flex-1 rounded-2xl bg-white/10 p-3">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                  Attendance
                </Text>
                <Text className="mt-0.5 text-[20px] font-extrabold text-white">{pct}%</Text>
                <ProgressBar
                  value={data.attendanceCounts?.present ?? 0}
                  total={data.attendanceCounts?.total ?? 1}
                  color="#F59E0B"
                />
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 p-3">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                  Fees due
                </Text>
                <Text className="mt-0.5 text-[20px] font-extrabold text-white" numberOfLines={1}>
                  ₹{feesDue.toLocaleString("en-IN")}
                </Text>
                <Text className="mt-1 text-[11px] font-semibold text-white/70">
                  {(data.feesDue || []).length} invoices · {data.todayTimetable?.length ?? 0} classes today
                </Text>
              </View>
            </View>
          </HeroCard>
        </View>

        {/* Stats */}
        <View className="mt-3 flex-row gap-2.5">
          <StatCard
            label="Today"
            value={data.attendanceToday?.status ?? "—"}
            sub={data.todayTimetable?.length ? `${data.todayTimetable.length} classes` : "No classes"}
            icon="today-outline"
            tint="bg-indigo-50"
            iconColor="#4F46E5"
          />
          <StatCard
            label="Homework"
            value={String(data.pendingHomework?.length ?? 0)}
            sub="pending tasks"
            icon="create-outline"
            tint="bg-amber-50"
            iconColor="#D97706"
          />
          <StatCard
            label="Exams"
            value={String(data.upcomingExams?.length ?? data.recentResults?.length ?? 0)}
            sub="upcoming"
            icon="document-text-outline"
            tint="bg-emerald-50"
            iconColor="#059669"
          />
        </View>

        {/* Today's classes */}
        <SectionHeader
          title="Today's classes"
          subtitle={data.todayTimetable?.length ? `${data.todayTimetable.length} periods scheduled` : undefined}
          actionLabel={data.todayTimetable?.length ? "Timetable" : undefined}
          onAction={() => router.push("/(student)/academics" as any)}
        />
        {!data.todayTimetable?.length ? (
          <EmptyView title="No classes today" hint="Enjoy your day off — catch up on homework." icon="sunny-outline" />
        ) : (
          <View className="gap-2.5">
            {data.todayTimetable.slice(0, 5).map((t: any, i: number) => (
              <Card key={t.id}>
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50">
                    <Text className="text-[13px] font-extrabold text-primary-700">{String(i + 1).padStart(2, "0")}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink">{t.subject?.name}</Text>
                    <Text className="mt-0.5 text-[12px] text-slate-500">
                      {t.startTime} – {t.endTime}
                      {t.teacher ? ` · ${t.teacher.firstName} ${t.teacher.lastName}` : ""}
                      {t.room ? ` · Room ${t.room}` : ""}
                    </Text>
                  </View>
                  <Pill text={t.startTime} tone="violet" />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Quick access */}
        <SectionHeader title="Quick access" subtitle="Jump to what matters" />
        <View className="flex-row flex-wrap gap-2.5">
          <Link href="/(student)/homework" asChild>
            <QuickAction label="Homework" hint={`${data.pendingHomework?.length ?? 0} due`} icon="pencil-outline" tint="bg-amber-50" iconColor="#D97706" />
          </Link>
          <Link href="/(student)/exams" asChild>
            <QuickAction label="Exams" hint="Schedule" icon="calendar-outline" tint="bg-indigo-50" iconColor="#4F46E5" />
          </Link>
          <Link href="/(student)/fees" asChild>
            <QuickAction label="Fees" hint="Pay & receipts" icon="wallet-outline" tint="bg-emerald-50" iconColor="#059669" />
          </Link>
          <Link href="/(student)/library" asChild>
            <QuickAction label="Library" hint="Books" icon="library-outline" tint="bg-sky-50" iconColor="#0284C7" />
          </Link>
          <Link href="/(student)/transport" asChild>
            <QuickAction label="Transport" hint="Bus & route" icon="bus-outline" tint="bg-orange-50" iconColor="#EA580C" />
          </Link>
          <Link href="/(student)/results" asChild>
            <QuickAction label="Results" hint="Report cards" icon="trophy-outline" tint="bg-violet-50" iconColor="#7C3AED" />
          </Link>
        </View>

        {/* Pending homework */}
        {!!data.pendingHomework?.length && (
          <>
            <SectionHeader
              title="Pending homework"
              actionLabel="View all"
              onAction={() => router.push("/(student)/homework" as any)}
            />
            <View className="gap-2.5">
              {data.pendingHomework.slice(0, 3).map((h: any) => (
                <Card key={h.id}>
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-amber-50">
                      <Ionicons name="pencil" size={18} color="#D97706" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-ink" numberOfLines={1}>{h.title}</Text>
                      <Text className="text-[12px] text-slate-500">
                        Due {new Date(h.dueDate).toLocaleDateString()}
                        {h.subject?.name ? ` · ${h.subject.name}` : ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}

        {/* Announcements */}
        {!!data.announcements?.length && (
          <>
            <SectionHeader title="Announcements" actionLabel="Notices" onAction={() => router.push("/(student)/notifications" as any)} />
            <View className="gap-2.5">
              {data.announcements.slice(0, 3).map((a: any) => (
                <Card key={a.id}>
                  <View className="flex-row gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50">
                      <Ionicons name="megaphone-outline" size={18} color="#4F46E5" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-ink">{a.title}</Text>
                      <Text className="mt-0.5 text-[13px] leading-5 text-slate-600" numberOfLines={2}>
                        {a.content}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}

        {/* Recent results */}
        {!!data.recentResults?.length && (
          <>
            <SectionHeader title="Recent results" actionLabel="Report card" onAction={() => router.push("/(student)/results" as any)} />
            <View className="gap-2.5">
              {data.recentResults.slice(0, 3).map((m: any) => (
                <Card key={m.id}>
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>
                      {m.examSubject?.subject?.name}
                    </Text>
                    <Pill
                      text={`${m.marksObtained ?? "—"}/${m.examSubject?.maxMarks}`}
                      tone={(m.marksObtained ?? 0) >= (m.examSubject?.passMarks ?? 0) ? "green" : "red"}
                    />
                  </View>
                  <Text className="mt-1 text-[12px] text-slate-500">
                    {m.examSubject?.exam?.name} ·{" "}
                    <Text style={{ color: statusTone("PRESENT") ? "#16A34A" : "#64748B" }}>Published</Text>
                  </Text>
                </Card>
              ))}
            </View>
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
