import { useQuery } from "@tanstack/react-query";
import { mobileApi } from "./mobile";
import { useAuthStore } from "../store/auth";

const STALE = 30_000;

export const qk = {
  me: ["me"],
  studentDashboard: ["mobile", "student-dashboard"],
  teacherDashboard: ["mobile", "teacher-dashboard"],
  timetable: ["mobile", "timetable"],
  attendance: (m?: number, y?: number) => ["mobile", "attendance", m, y],
  homework: ["mobile", "homework"],
  exams: ["mobile", "exams"],
  results: ["mobile", "results"],
  fees: ["mobile", "fees"],
  library: ["mobile", "library"],
  transport: ["mobile", "transport"],
  notifications: ["mobile", "notifications"],
  announcements: ["mobile", "announcements"],
  teacherClasses: ["mobile", "teacher-classes"],
  teacherStudents: (c?: string, s?: string) => ["mobile", "teacher-students", c, s],
  teacherHomework: ["mobile", "teacher-homework"],
  teacherCompletions: (id?: string) => ["mobile", "teacher-completions", id],
} as const;

export function useMe() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: qk.me,
    queryFn: mobileApi.me,
    staleTime: STALE,
    enabled: !!user,
  });
}

export function useStudentDashboard() {
  return useQuery({ queryKey: qk.studentDashboard, queryFn: mobileApi.studentDashboard, staleTime: STALE });
}

export function useTeacherDashboard() {
  return useQuery({ queryKey: qk.teacherDashboard, queryFn: mobileApi.teacherDashboard, staleTime: STALE });
}

export function useTimetable() {
  return useQuery({ queryKey: qk.timetable, queryFn: mobileApi.timetable, staleTime: STALE });
}

export function useAttendance(month?: number, year?: number) {
  return useQuery({
    queryKey: qk.attendance(month, year),
    queryFn: () => mobileApi.attendance(month, year),
    staleTime: STALE,
  });
}

export function useHomework() {
  return useQuery({ queryKey: qk.homework, queryFn: mobileApi.homework, staleTime: STALE });
}

export function useExams() {
  return useQuery({ queryKey: qk.exams, queryFn: mobileApi.exams, staleTime: STALE });
}

export function useResults() {
  return useQuery({ queryKey: qk.results, queryFn: mobileApi.results, staleTime: STALE });
}

export function useFees() {
  return useQuery({ queryKey: qk.fees, queryFn: mobileApi.fees, staleTime: STALE });
}

export function useLibrary() {
  return useQuery({ queryKey: qk.library, queryFn: mobileApi.library, staleTime: STALE });
}

export function useTransport() {
  return useQuery({ queryKey: qk.transport, queryFn: mobileApi.transport, staleTime: STALE });
}

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications, queryFn: mobileApi.notifications, staleTime: STALE });
}

export function useAnnouncements() {
  return useQuery({ queryKey: qk.announcements, queryFn: mobileApi.announcements, staleTime: STALE });
}

export function useTeacherClasses() {
  return useQuery({ queryKey: qk.teacherClasses, queryFn: mobileApi.teacherClasses, staleTime: STALE });
}

export function useTeacherHomework() {
  return useQuery({ queryKey: qk.teacherHomework, queryFn: mobileApi.teacherHomework, staleTime: STALE });
}

export function useTeacherCompletions(homeworkId?: string) {
  return useQuery({
    queryKey: qk.teacherCompletions(homeworkId),
    queryFn: () => mobileApi.teacherCompletions(homeworkId as string),
    staleTime: STALE,
    enabled: !!homeworkId,
  });
}

export function useTeacherStudents(classId?: string, sectionId?: string) {
  return useQuery({
    queryKey: qk.teacherStudents(classId, sectionId),
    queryFn: () => mobileApi.teacherStudents(classId, sectionId),
    staleTime: STALE,
    enabled: !!classId || classId === undefined,
  });
}
