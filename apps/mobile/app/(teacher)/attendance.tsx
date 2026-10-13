import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/api/mobile";
import { useTeacherClasses } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { Card, EmptyView, LoadingView, Pill, Screen, SectionTitle } from "../../src/components/ui";

type Mark = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";
const MARKS: Mark[] = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE"];

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

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of classes.data || []) map.set(e.classId, e.class?.name || e.classId);
    return Array.from(map.entries());
  }, [classes.data]);

  const loadRoster = async (cid: string) => {
    setClassId(cid);
    setLoading(true);
    setMsg(null);
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
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!classId || !user?.schoolId) return;
    setLoading(true);
    setMsg(null);
    try {
      await mobileApi.markAttendanceBulk({
        date,
        schoolId: user.schoolId,
        classId,
        records: roster.map((s) => ({ studentId: s.id, status: marks[s.id] || "PRESENT" })),
      });
      setMsg(`Attendance submitted for ${roster.length} students ✓`);
      queryClient.invalidateQueries({ queryKey: ["mobile"] });
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (classes.isLoading) return <LoadingView message="Loading classes…" />;

  return (
    <Screen refreshing={false} onRefresh={() => classes.refetch()}>
      <SectionTitle>1 · Pick an assigned class ({date})</SectionTitle>
      {!classOptions.length ? (
        <EmptyView title="No classes assigned" />
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {classOptions.map(([id, name]) => (
            <Pressable
              key={id}
              onPress={() => loadRoster(id)}
              className={`rounded-full px-4 py-2 ${classId === id ? "bg-primary-600" : "bg-white"}`}
            >
              <Text className={`text-sm font-semibold ${classId === id ? "text-white" : "text-slate-700"}`}>
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!!classId && (
        <>
          <SectionTitle>2 · Mark roster ({roster.length})</SectionTitle>
          {loading && !roster.length ? (
            <LoadingView message="Loading roster…" />
          ) : (
            <View className="gap-2">
              {roster.map((s) => (
                <Card key={s.id}>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="font-semibold text-slate-900">
                        {s.firstName} {s.lastName}
                      </Text>
                      <Text className="text-xs text-slate-500">{s.admissionNumber}</Text>
                    </View>
                    <Pill text={marks[s.id] || "—"} tone={marks[s.id] === "PRESENT" ? "green" : marks[s.id] === "ABSENT" ? "red" : "amber"} />
                  </View>
                  <View className="mt-2 flex-row flex-wrap gap-1.5">
                    {MARKS.map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setMarks((prev) => ({ ...prev, [s.id]: m }))}
                        className={`rounded-full px-2.5 py-1.5 ${
                          marks[s.id] === m ? "bg-sidebar" : "bg-slate-100"
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-semibold ${
                            marks[s.id] === m ? "text-white" : "text-slate-600"
                          }`}
                        >
                          {m}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              ))}
            </View>
          )}
          {!!roster.length && (
            <Pressable
              className="mt-3 items-center rounded-xl bg-primary-600 py-4"
              onPress={submit}
              disabled={loading}
            >
              <Text className="font-bold text-white">
                {loading ? "Submitting…" : `Submit attendance (${roster.length})`}
              </Text>
            </Pressable>
          )}
        </>
      )}
      {!!msg && (
        <Text className="mt-3 text-center text-sm text-slate-600">{msg}</Text>
      )}
    </Screen>
  );
}
