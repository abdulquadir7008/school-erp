import { Text, View, Pressable } from "react-native";
import { Link } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useStudentDashboard } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import {
  Card, EmptyView, ErrorView, Muted, Pill, Screen, SectionTitle, StatCard, statusTone,
} from "../../src/components/ui";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_LINKS = [
  { href: "/(student)/fees", label: "Fees", icon: "💳" },
  { href: "/(student)/library", label: "Library", icon: "📚" },
  { href: "/(student)/transport", label: "Transport", icon: "🚌" },
  { href: "/(student)/homework", label: "Homework", icon: "📝" },
  { href: "/(student)/exams", label: "Exams", icon: "📋" },
  { href: "/(student)/notifications", label: "Notices", icon: "🔔" },
] as const;

export default function StudentHome() {
  const queryClient = useQueryClient();
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
      <Screen>
        <View className="h-28 rounded-2xl bg-slate-200/70" />
        <View className="mt-3 flex-row gap-2">
          <View className="h-20 flex-1 rounded-2xl bg-slate-200/70" />
          <View className="h-20 flex-1 rounded-2xl bg-slate-200/70" />
          <View className="h-20 flex-1 rounded-2xl bg-slate-200/70" />
        </View>
      </Screen>
    );
  }
  if (isError || !data) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const s = data.student;
  const feesDue = (data.feesDue || []).reduce(
    (sum: number, i: any) => sum + Number(i.totalAmount) - Number(i.paidAmount),
    0
  );

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Card className="bg-sidebar">
        <Muted>
          <Text className="text-slate-400">
            {greeting()}, {s.firstName} 👋
          </Text>
        </Muted>
        <Text className="mt-1 text-xl font-bold text-white">
          {s.firstName} {s.lastName}
        </Text>
        <Text className="mt-0.5 text-sm text-slate-300">
          {s.class?.name}
          {s.section?.name ? ` · Sec ${s.section.name}` : ""} · {s.admissionNumber}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-400">{s.school?.name}</Text>
      </Card>

      <View className="mt-3 flex-row gap-2">
        <StatCard label="Attendance" value={`${data.attendancePercentage}%`} sub={`${data.attendanceCounts.present}/${data.attendanceCounts.total} days`} />
        <StatCard
          label="Today"
          value={data.attendanceToday?.status || "—"}
          sub={data.todayTimetable?.length ? `${data.todayTimetable.length} classes` : "No classes"}
        />
        <StatCard label="Fees due" value={`₹${feesDue.toLocaleString("en-IN")}`} sub={`${(data.feesDue || []).length} invoices`} />
      </View>

      <SectionTitle>Today&apos;s classes</SectionTitle>
      {!data.todayTimetable?.length ? (
        <EmptyView title="No classes today" hint="Enjoy your day off!" />
      ) : (
        <View className="gap-2">
          {data.todayTimetable.slice(0, 5).map((t: any) => (
            <Card key={t.id}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-semibold text-slate-900">{t.subject?.name}</Text>
                  <Text className="text-xs text-slate-500">
                    {t.startTime} – {t.endTime}
                    {t.teacher ? ` · ${t.teacher.firstName} ${t.teacher.lastName}` : ""}
                    {t.room ? ` · Room ${t.room}` : ""}
                  </Text>
                </View>
                <Pill text={t.startTime} tone="green" />
              </View>
            </Card>
          ))}
        </View>
      )}

      <SectionTitle>Quick access</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {QUICK_LINKS.map((q) => (
          <Link key={q.href} href={q.href as any} asChild>
            <Pressable className="w-[31%] items-center rounded-2xl bg-white p-4 shadow-sm shadow-slate-200">
              <Text className="text-2xl">{q.icon}</Text>
              <Text className="mt-1 text-xs font-semibold text-slate-700">{q.label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      {!!data.pendingHomework?.length && (
        <>
          <SectionTitle>Pending homework</SectionTitle>
          <View className="gap-2">
            {data.pendingHomework.slice(0, 3).map((h: any) => (
              <Card key={h.id}>
                <Text className="font-semibold text-slate-900">{h.title}</Text>
                <Text className="text-xs text-slate-500">
                  Due {new Date(h.dueDate).toLocaleDateString()}
                </Text>
              </Card>
            ))}
          </View>
        </>
      )}

      {!!data.announcements?.length && (
        <>
          <SectionTitle>Announcements</SectionTitle>
          <View className="gap-2">
            {data.announcements.slice(0, 3).map((a: any) => (
              <Card key={a.id}>
                <Text className="font-semibold text-slate-900">{a.title}</Text>
                <Text className="mt-0.5 text-sm text-slate-600" numberOfLines={2}>
                  {a.content}
                </Text>
              </Card>
            ))}
          </View>
        </>
      )}

      {!!data.recentResults?.length && (
        <>
          <SectionTitle>Recent results (published)</SectionTitle>
          <View className="gap-2">
            {data.recentResults.slice(0, 3).map((m: any) => (
              <Card key={m.id}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-slate-900">{m.examSubject?.subject?.name}</Text>
                  <Pill
                    text={`${m.marksObtained ?? "—"}/${m.examSubject?.maxMarks}`}
                    tone={statusTone((m.marksObtained ?? 0) >= (m.examSubject?.passMarks ?? 0) ? "PRESENT" : "ABSENT")}
                  />
                </View>
                <Text className="text-xs text-slate-500">{m.examSubject?.exam?.name}</Text>
              </Card>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
