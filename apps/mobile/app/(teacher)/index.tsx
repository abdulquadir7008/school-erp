import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTeacherDashboard } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Avatar, Card, EmptyView, ErrorView, HeroCard, QuickAction, Screen, SectionHeader, SkeletonList, StatCard, greeting } from "../../src/components/ui";

export default function TeacherHome() {
  const queryClient = useQueryClient();
  const router = useRouter();
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

  const t = data.teacher;
  const fullName = `${t.firstName} ${t.lastName}`;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Avatar name={fullName} size={44} bg="#0D9488" />
            <View>
              <Text className="text-[12px] font-semibold text-slate-400">{greeting()},</Text>
              <Text className="text-[16px] font-extrabold tracking-tight text-ink">{t.firstName}</Text>
            </View>
          </View>
          <Link href="/(teacher)/notifications" asChild>
            <Pressable className="relative h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white">
              <Ionicons name="notifications-outline" size={20} color="#0F172A" />
              {(data.announcements?.length ?? 0) > 0 && (
                <View className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal-500" />
              )}
            </Pressable>
          </Link>
        </View>

        <View className="mt-4">
          <HeroCard
            eyebrow={`${t.employeeId} · ${t.specialization || "Faculty"}`}
            title={fullName}
            subtitle={t.school?.name ?? ""}
            meta={`${data.totalClasses} classes · ${data.totalStudents} students`}
            deep="#042F2E"
            accent="#14B8A6"
          >
            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 items-center rounded-2xl bg-teal-500 py-3 active:opacity-85"
                onPress={() => router.push("/(teacher)/attendance" as any)}
              >
                <Text className="text-[13px] font-extrabold text-white">Mark attendance</Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-2xl bg-white/15 py-3 active:opacity-80"
                onPress={() => router.push("/(teacher)/homework" as any)}
              >
                <Text className="text-[13px] font-extrabold text-white">Post homework</Text>
              </Pressable>
            </View>
          </HeroCard>
        </View>

        <View className="mt-3 flex-row gap-2.5">
          <StatCard label="Classes" value={String(data.totalClasses)} icon="people-outline" tint="bg-teal-50" iconColor="#0D9488" />
          <StatCard label="Students" value={String(data.totalStudents)} icon="person-outline" tint="bg-indigo-50" iconColor="#4F46E5" />
          <StatCard label="Subjects" value={String(data.totalSubjects)} icon="book-outline" tint="bg-amber-50" iconColor="#D97706" />
        </View>

        <SectionHeader title="Today's classes" subtitle={data.todayClasses?.length ? `${data.todayClasses.length} periods` : undefined} actionLabel="Timetable" onAction={() => router.push("/(teacher)/timetable" as any)} />
        {!data.todayClasses?.length ? (
          <EmptyView title="No classes today" hint="Plan lessons or review homework." icon="sunny-outline" />
        ) : (
          <View className="gap-2.5">
            {data.todayClasses.map((c: any, i: number) => (
              <Card key={c.id}>
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-teal-50">
                    <Text className="text-[13px] font-extrabold text-teal-700">{String(i + 1).padStart(2, "0")}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink">{c.class?.name} · {c.subject?.name}</Text>
                    <Text className="mt-0.5 text-[12px] text-slate-500">{c.startTime} – {c.endTime}{c.room ? ` · Room ${c.room}` : ""}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        <SectionHeader title="Quick actions" subtitle="Daily workflows" />
        <View className="flex-row flex-wrap gap-2.5">
          <Link href="/(teacher)/attendance" asChild>
            <QuickAction label="Attendance" hint="Mark today" icon="checkmark-circle-outline" tint="bg-teal-50" iconColor="#0D9488" />
          </Link>
          <Link href="/(teacher)/homework" asChild>
            <QuickAction label="Homework" hint="Post task" icon="create-outline" tint="bg-amber-50" iconColor="#D97706" />
          </Link>
          <Link href="/(teacher)/exams" asChild>
            <QuickAction label="Marks" hint="Enter scores" icon="trophy-outline" tint="bg-violet-50" iconColor="#7C3AED" />
          </Link>
          <Link href="/(teacher)/classes" asChild>
            <QuickAction label="Classes" hint="Roster" icon="people-outline" tint="bg-indigo-50" iconColor="#4F46E5" />
          </Link>
          <Link href="/(teacher)/timetable" asChild>
            <QuickAction label="Timetable" hint="Week view" icon="calendar-outline" tint="bg-sky-50" iconColor="#0284C7" />
          </Link>
          <Link href="/(teacher)/notifications" asChild>
            <QuickAction label="Notices" hint="Updates" icon="megaphone-outline" tint="bg-orange-50" iconColor="#EA580C" />
          </Link>
        </View>

        {!!data.upcomingExams?.length && (
          <>
            <SectionHeader title="Upcoming examinations" actionLabel="Marks" onAction={() => router.push("/(teacher)/exams" as any)} />
            <View className="gap-2.5">
              {data.upcomingExams.map((e: any) => (
                <Card key={e.id}>
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-violet-50">
                      <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-ink">{e.name}</Text>
                      <Text className="text-[12px] text-slate-500">Starts {new Date(e.startDate).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}

        {!!data.announcements?.length && (
          <>
            <SectionHeader title="Announcements" />
            <View className="gap-2.5">
              {data.announcements.slice(0, 3).map((a: any) => (
                <Card key={a.id}>
                  <View className="flex-row gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-teal-50">
                      <Ionicons name="megaphone-outline" size={18} color="#0D9488" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-ink">{a.title}</Text>
                      <Text className="mt-0.5 text-[13px] text-slate-600" numberOfLines={2}>{a.content}</Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
