import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useTeacherClasses } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { Avatar, Card, EmptyView, LoadingView, Screen, SectionHeader } from "../../src/components/ui";

type Mark = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";
const MARKS: Mark[] = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE"];

const MARK_STYLE: Record<Mark, { bg: string; fg: string }> = {
  PRESENT: { bg: "#DCFCE7", fg: "#15803D" },
  ABSENT: { bg: "#FEE2E2", fg: "#DC2626" },
  LATE: { bg: "#FEF3C7", fg: "#B45309" },
  HALF_DAY: { bg: "#FEF3C7", fg: "#B45309" },
  LEAVE: { bg: "#E0E7FF", fg: "#4338CA" },
};

export default function MarkAttendance() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const classes = useTeacherClasses();
  const [classId, setClassId] = useState<string | null>(null);
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of classes.data || []) map.set(e.classId, e.class?.name || e.classId);
    return Array.from(map.entries());
  }, [classes.data]);

  const loadRoster = async (cid: string) => {
    setClassId(cid);
    setLoading(true);
    setMsg(null);
    setIsError(false);
    try {
      const r = await mobileApi.roster(cid, undefined, date);
      setRoster(r.students);
      const preset: Record<string, Mark> = {};
      for (const s of r.students) {
        preset[s.id] = (s.attendance?.status as Mark) || "PRESENT";
      }
      setMarks(preset);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const markAll = (m: Mark) => {
    const next: Record<string, Mark> = {};
    for (const s of roster) next[s.id] = m;
    setMarks(next);
  };

  const submit = async () => {
    if (!classId || !user?.schoolId) return;
    setLoading(true);
    setMsg(null);
    setIsError(false);
    try {
      await mobileApi.markAttendanceBulk({
        date,
        schoolId: user.schoolId,
        classId,
        records: roster.map((s) => ({ studentId: s.id, status: marks[s.id] || "PRESENT" })),
      });
      setMsg(`Attendance submitted for ${roster.length} students`);
      queryClient.invalidateQueries({ queryKey: ["mobile"] });
    } catch (e) {
      setMsg(getApiErrorMessage(e));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  if (classes.isLoading) return <LoadingView message="Loading classes…" />;

  const presentCount = roster.filter((s) => (marks[s.id] || "PRESENT") === "PRESENT").length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={false} onRefresh={() => classes.refetch()}>
        <SectionHeader title="Mark attendance" subtitle={date} />
        {!classOptions.length ? (
          <EmptyView title="No classes assigned" icon="people-outline" />
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {classOptions.map(([id, name]) => (
              <Pressable
                key={id}
                onPress={() => loadRoster(id)}
                className={`rounded-full px-4 py-2.5 ${classId === id ? "bg-tealbrand-600" : "border border-slate-200 bg-white"}`}
              >
                <Text className={`text-[13px] font-bold ${classId === id ? "text-white" : "text-ink"}`}>{name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!!classId && (
          <>
            <View className="mt-4 flex-row items-center justify-between rounded-[20px] bg-ink p-4">
              <View>
                <Text className="text-[12px] font-semibold text-white/60">ROSTER</Text>
                <Text className="text-[16px] font-extrabold text-white">{roster.length} students · {presentCount} present</Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable onPress={() => markAll("PRESENT")} className="rounded-full bg-emerald-400 px-3.5 py-2 active:opacity-80">
                  <Text className="text-[11px] font-extrabold text-ink">All present</Text>
                </Pressable>
              </View>
            </View>

            <SectionHeader title="Roster" subtitle="Tap a status per student" />
            {loading && !roster.length ? (
              <LoadingView message="Loading roster…" />
            ) : (
              <View className="gap-2.5">
                {roster.map((s) => {
                  const m = marks[s.id] || "PRESENT";
                  return (
                    <Card key={s.id}>
                      <View className="flex-row items-center gap-3">
                        <Avatar name={`${s.firstName} ${s.lastName}`} size={40} bg="#0D9488" />
                        <View className="flex-1">
                          <Text className="text-[14px] font-bold text-ink">{s.firstName} {s.lastName}</Text>
                          <Text className="text-[12px] text-slate-500">{s.admissionNumber}</Text>
                        </View>
                        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: MARK_STYLE[m].bg }}>
                          <Text className="text-[11px] font-extrabold" style={{ color: MARK_STYLE[m].fg }}>{m}</Text>
                        </View>
                      </View>
                      <View className="mt-2.5 flex-row flex-wrap gap-1.5">
                        {MARKS.map((opt) => (
                          <Pressable
                            key={opt}
                            onPress={() => setMarks((prev) => ({ ...prev, [s.id]: opt }))}
                            className={`rounded-full px-3 py-1.5 ${m === opt ? "bg-ink" : "bg-slate-100"}`}
                          >
                            <Text className={`text-[11px] font-bold ${m === opt ? "text-white" : "text-slate-600"}`}>
                              {opt.replace("_", " ")}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
            {!!roster.length && (
              <Pressable
                className="mt-4 items-center rounded-2xl bg-tealbrand-600 py-4 active:opacity-85"
                onPress={submit}
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                <Text className="text-[15px] font-extrabold text-white">
                  {loading ? "Submitting…" : `Submit attendance (${roster.length})`}
                </Text>
              </Pressable>
            )}
          </>
        )}
        {!!msg && (
          <View className={`mt-3 flex-row items-center gap-2 rounded-2xl p-3.5 ${isError ? "bg-red-50" : "bg-emerald-50"}`}>
            <Ionicons name={isError ? "alert-circle" : "checkmark-circle"} size={18} color={isError ? "#DC2626" : "#059669"} />
            <Text className={`flex-1 text-[13px] font-semibold ${isError ? "text-red-700" : "text-emerald-800"}`}>{msg}</Text>
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
