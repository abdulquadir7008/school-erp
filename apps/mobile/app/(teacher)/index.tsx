import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTeacherDashboard } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, ErrorView, Muted, Screen, SectionTitle, StatCard } from "../../src/components/ui";

const QUICK = [
  { href: "/(teacher)/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/(teacher)/exams", label: "Exams & Marks", icon: "📝" },
  { href: "/(teacher)/notifications", label: "Notices", icon: "🔔" },
  { href: "/(teacher)/attendance", label: "Mark Attendance", icon: "✅" },
] as const;

export default function TeacherHome() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, isError, error, refetch } = useTeacherDashboard();

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

  const t = data.teacher;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Card className="bg-sidebar">
        <Muted><Text className="text-slate-400">Welcome back, {t.firstName} 👩‍🏫</Text></Muted>
        <Text className="mt-1 text-xl font-bold text-white">
          {t.firstName} {t.lastName}
        </Text>
        <Text className="mt-0.5 text-sm text-slate-300">
          {t.employeeId} · {t.school?.name}
        </Text>
      </Card>

      <View className="mt-3 flex-row gap-2">
        <StatCard label="Classes" value={String(data.totalClasses)} />
        <StatCard label="Students" value={String(data.totalStudents)} />
        <StatCard label="Subjects" value={String(data.totalSubjects)} />
      </View>

      <SectionTitle>Today&apos;s classes</SectionTitle>
      {!data.todayClasses?.length ? (
        <Card><Muted>No classes scheduled today.</Muted></Card>
      ) : (
        <View className="gap-2">
          {data.todayClasses.map((c: any) => (
            <Card key={c.id}>
              <Text className="font-semibold text-slate-900">
                {c.class?.name} · {c.subject?.name}
              </Text>
              <Text className="text-xs text-slate-500">
                {c.startTime} – {c.endTime}{c.room ? ` · Room ${c.room}` : ""}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <SectionTitle>Quick access</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href as any} asChild>
            <Pressable className="w-[48%] items-center rounded-2xl bg-white p-4 shadow-sm shadow-slate-200">
              <Text className="text-2xl">{q.icon}</Text>
              <Text className="mt-1 text-xs font-semibold text-slate-700">{q.label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      {!!data.upcomingExams?.length && (
        <>
          <SectionTitle>Upcoming examinations</SectionTitle>
          <View className="gap-2">
            {data.upcomingExams.map((e: any) => (
              <Card key={e.id}>
                <Text className="font-semibold text-slate-900">{e.name}</Text>
                <Text className="text-xs text-slate-500">
                  Starts {new Date(e.startDate).toLocaleDateString()}
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
                <Text className="mt-0.5 text-sm text-slate-600" numberOfLines={2}>{a.content}</Text>
              </Card>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
