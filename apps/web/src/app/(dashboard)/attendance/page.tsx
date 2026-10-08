"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Users,
  UserCheck,
  UserX,
  Clock,
  CalendarCheck,
  Loader2,
  Building2,
  BookOpen,
  Layers,
  Save,
  CheckCheck,
  Ban,
  Sun,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";

const STATUS_OPTIONS: { value: AttendanceStatus; labelKey: string; activeClass: string }[] = [
  { value: "PRESENT", labelKey: "attendance.status.present", activeClass: "bg-green-600 text-white" },
  { value: "ABSENT", labelKey: "attendance.status.absent", activeClass: "bg-red-500 text-white" },
  { value: "LATE", labelKey: "attendance.status.late", activeClass: "bg-amber-500 text-white" },
  { value: "HALF_DAY", labelKey: "attendance.status.halfDay", activeClass: "bg-orange-500 text-white" },
  { value: "LEAVE", labelKey: "attendance.status.leave", activeClass: "bg-blue-600 text-white" },
];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-800 border-green-200",
  ABSENT: "bg-red-100 text-red-800 border-red-200",
  LATE: "bg-amber-100 text-amber-800 border-amber-200",
  HALF_DAY: "bg-orange-100 text-orange-800 border-orange-200",
  LEAVE: "bg-blue-100 text-blue-800 border-blue-200",
};

interface RosterStudent {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  rollNumber: number | null;
  section: { id: string; name: string } | null;
  attendance: { id: string; status: AttendanceStatus; remarks?: string | null } | null;
}

export default function AttendancePage() {
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";

  const effectiveSchoolId = isSuperAdmin ? schoolId : user?.schoolId || "";
  const selectedDate = new Date(`${date}T00:00:00`).toISOString();

  const schoolsQuery = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => {
      const response = await api.get("/schools", { params: { limit: 100 } });
      return response.data.data || [];
    },
    enabled: !!isSuperAdmin,
  });

  const classesQuery = useQuery({
    queryKey: ["classes-list", effectiveSchoolId],
    queryFn: async () => {
      const response = await api.get(`/schools/${effectiveSchoolId}/classes`);
      return response.data.data || [];
    },
    enabled: !!effectiveSchoolId,
  });

  const sectionsQuery = useQuery({
    queryKey: ["sections-list", effectiveSchoolId, classId],
    queryFn: async () => {
      const response = await api.get(
        `/schools/${effectiveSchoolId}/classes/${classId}/sections`
      );
      return response.data.data || [];
    },
    enabled: !!(effectiveSchoolId && classId),
  });

  const rosterQuery = useQuery({
    queryKey: ["attendance-roster", effectiveSchoolId, classId, sectionId, selectedDate],
    queryFn: async () => {
      const response = await api.get("/attendance/roster", {
        params: { classId, sectionId: sectionId || undefined, date: selectedDate },
      });
      return response.data.data;
    },
    enabled: !!classId,
  });

  const students: RosterStudent[] = rosterQuery.data?.students || [];

  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    for (const student of students) {
      if (student.attendance) {
        next[student.id] = student.attendance.status;
      }
    }
    setStatusMap(next);
  }, [rosterQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (records: { studentId: string; status: AttendanceStatus }[]) => {
      await api.post("/attendance/bulk", {
        date: selectedDate,
        schoolId: effectiveSchoolId,
        classId,
        records,
      });
    },
    onSuccess: () => {
      toast.success(t("attendance.saved"));
      queryClient.invalidateQueries({ queryKey: ["attendance-roster"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let leave = 0;
    let unmarked = 0;
    for (const student of students) {
      const status = statusMap[student.id];
      if (status === "PRESENT") present += 1;
      else if (status === "ABSENT") absent += 1;
      else if (status === "LATE") late += 1;
      else if (status === "HALF_DAY") halfDay += 1;
      else if (status === "LEAVE") leave += 1;
      else unmarked += 1;
    }
    const total = students.length;
    const marked = Math.max(0, total - unmarked);
    const scored = present + late + halfDay;
    const percentage = total ? Math.round((scored / (marked || total)) * 100) : 0;
    return { total, present, absent, late, halfDay, leave, unmarked, marked, percentage };
  }, [students, statusMap]);

  const selectStatus = (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const applyBulk = (status: AttendanceStatus) => {
    if (!students.length) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const student of students) {
      next[student.id] = status;
    }
    setStatusMap(next);
  };

  const handleSave = () => {
    const records = students
      .filter((s) => statusMap[s.id])
      .map((s) => ({ studentId: s.id, status: statusMap[s.id] }));
    if (!records.length) {
      toast.error(t("attendance.selectAtLeastOne"));
      return;
    }
    saveMutation.mutate(records);
  };

  const canMark = !!classId && !rosterQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.attendance")}</h1>
          <p className="text-sm text-slate-500">{t("attendance.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <CalendarDays className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="date"
              className="w-44 ps-9"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending || !canMark}>
            {saveMutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ms-2 h-4 w-4" />
            )}
            {t("attendance.save")}
          </Button>
        </div>
      </div>

      <Card className="border-primary-200 bg-primary-50/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isSuperAdmin && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <Building2 className="ms-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t("attendance.school")}
                </label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={schoolId}
                  onChange={(e) => {
                    setSchoolId(e.target.value);
                    setClassId("");
                    setSectionId("");
                    setStatusMap({});
                  }}
                >
                  <option value="">{t("attendance.selectSchool")}</option>
                  {(schoolsQuery.data || []).map((school: any) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                <BookOpen className="ms-1 inline h-3.5 w-3.5 text-slate-400" />
                {t("attendance.classLabel")}
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId("");
                  setStatusMap({});
                }}
                disabled={!effectiveSchoolId}
              >
                <option value="">
                  {!effectiveSchoolId ? t("attendance.selectSchoolFirst") : t("attendance.selectClass")}
                </option>
                {(classesQuery.data || []).map((cls: any) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                <Layers className="ms-1 inline h-3.5 w-3.5 text-slate-400" />
                {t("attendance.sectionLabel")}
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setStatusMap({});
                }}
                disabled={!classId}
              >
                <option value="">
                  {!classId ? t("attendance.selectClassFirst") : t("attendance.allSections")}
                </option>
                {(sectionsQuery.data || []).map((sec: any) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard title={t("attendance.statPresentPercentage")} value={`${stats.percentage}%`} icon={<UserCheck className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
        <StatCard title={t("attendance.status.present")} value={String(stats.present)} icon={<UserCheck className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
        <StatCard title={t("attendance.status.absent")} value={String(stats.absent)} icon={<UserX className="h-5 w-5" />} iconBg="bg-red-50 text-red-600" />
        <StatCard title={t("attendance.status.late")} value={String(stats.late)} icon={<Clock className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
        <StatCard title={t("attendance.status.leave")} value={String(stats.leave + stats.halfDay)} icon={<CalendarCheck className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
        <StatCard title={t("attendance.status.unmarked")} value={String(stats.unmarked)} icon={<Users className="h-5 w-5" />} iconBg="bg-slate-50 text-slate-600" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {t("attendance.markAttendance")}
              {classId && <span className="ms-2 text-sm font-normal text-slate-500">— {new Date(date).toLocaleDateString()}</span>}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!students.length} onClick={() => applyBulk("PRESENT")}>
                <CheckCheck className="ms-1.5 h-4 w-4 text-green-600" />
                {t("attendance.allPresent")}
              </Button>
              <Button variant="outline" size="sm" disabled={!students.length} onClick={() => applyBulk("ABSENT")}>
                <Ban className="ms-1.5 h-4 w-4 text-red-500" />
                {t("attendance.allAbsent")}
              </Button>
              <Button variant="outline" size="sm" disabled={!students.length} onClick={() => applyBulk("LEAVE")}>
                <Sun className="ms-1.5 h-4 w-4 text-blue-600" />
                {t("attendance.allLeave")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!classId ? (
            <EmptyState
              title={t("attendance.selectClassToBegin")}
              description={t("attendance.selectClassToBeginDesc")}
            />
          ) : rosterQuery.isLoading ? (
            <LoadingState />
          ) : rosterQuery.isError ? (
            <ErrorState message={t("attendance.loadFailed")} onRetry={() => rosterQuery.refetch()} />
          ) : students.length === 0 ? (
            <EmptyState
              title={t("attendance.noStudents")}
              description={t("attendance.noStudentsDesc")}
            />
          ) : (
            <>
              <div className="space-y-2">
                {students.map((student) => {
                  const current = statusMap[student.id];
                  return (
                    <div
                      key={student.id}
                      className={`flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        current
                          ? STATUS_STYLE[current]
                          : "border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                          {student.firstName[0]}
                          {student.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {student.admissionNumber}
                            {student.rollNumber ? ` · ${t("attendance.roll", { n: student.rollNumber })}` : ""}
                            {student.section?.name ? ` · ${student.section.name}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {STATUS_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => selectStatus(student.id, option.value)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                              current === option.value
                                ? option.activeClass
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {t(option.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-500">
                  {t("attendance.markedOf", { marked: stats.marked, total: stats.total })}
                </p>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="ms-2 h-4 w-4" />
                  )}
                  {saveMutation.isPending ? t("common.saving") : t("attendance.save")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}