import { api, ApiEnvelope } from "./client";
import * as FileSystem from "expo-file-system/legacy";
import { getTokens } from "./client";

// Typed wrappers around the SchoolSphere REST API.
// Mobile-first endpoints live under /mobile/* (strict self-scoping on the backend).

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: string;
  school: { id: string; name: string; schoolCode: string; logo?: string } | null;
  schoolId: string | null;
  student: any | null;
  teacher: any | null;
}

export async function loginRequest(identifier: string, password: string) {
  const res = await api.post<ApiEnvelope<{
    user: Record<string, unknown>;
    accessToken: string;
    refreshToken: string;
  }>>("/auth/login", { identifier, password });
  return res.data.data;
}

export async function fetchProfile(): Promise<Profile> {
  const res = await api.get<ApiEnvelope<Profile>>("/auth/profile");
  return res.data.data;
}

export async function changePasswordRequest(currentPassword: string, newPassword: string) {
  const res = await api.post("/auth/change-password", { currentPassword, newPassword });
  return res.data;
}

export async function logoutRequest(refreshToken: string | null) {
  if (!refreshToken) return;
  await api.post("/auth/logout", { refreshToken });
}

const get = async <T>(path: string, params?: Record<string, unknown>): Promise<T> => {
  const res = await api.get<ApiEnvelope<T>>(path, { params });
  return res.data.data;
};

export const mobileApi = {
  me: () => get<any>("/mobile/me"),
  studentDashboard: () => get<any>("/mobile/dashboard"),
  timetable: () => get<any[]>("/mobile/timetable"),
  attendance: (month?: number, year?: number) =>
    get<any>("/mobile/attendance", month && year ? { month, year } : undefined),
  homework: () => get<{ homework: any[]; assignments: any[] }>("/mobile/homework"),
  exams: () => get<any[]>("/mobile/exams"),
  results: () => get<any[]>("/mobile/results"),
  fees: () => get<any>("/mobile/fees"),
  library: () => get<any>("/mobile/library"),
  transport: () => get<any>("/mobile/transport"),
  notifications: () => get<any[]>("/mobile/notifications"),
  announcements: () => get<any[]>("/mobile/announcements"),
  teacherDashboard: () => get<any>("/mobile/teacher/dashboard"),
  teacherClasses: () => get<any[]>("/mobile/teacher/classes"),
  teacherStudents: (classId?: string, sectionId?: string) =>
    get<any[]>("/mobile/teacher/students", { classId, sectionId }),
  teacherHomework: () => get<any[]>("/mobile/teacher/homework"),
  teacherCompletions: (id: string) =>
    get<{ homework: any; students: any[]; stats: any }>(`/mobile/teacher/homework/${id}/completions`),
  updateTeacherCompletions: (id: string, updates: { studentId: string; status: string; teacherRemark?: string }[]) =>
    api.patch(`/mobile/teacher/homework/${id}/completions`, { updates }).then((r) => r.data.data),
  submitHomework: (id: string, payload: { submissionText?: string; attachmentUrl?: string }) =>
    api.post(`/mobile/homework/${id}/submit`, payload).then((r) => r.data),
  // ---- Assignments ----
  studentAssignments: () => get<any[]>("/mobile/assignments"),
  submitAssignment: (id: string, payload: { submissionText?: string; attachmentIds?: string[] }) =>
    api.post(`/mobile/assignments/${id}/submit`, payload).then((r) => r.data),
  uploadAssignmentFile: async (uri: string, name: string, mimeType: string) => {
    const form = new FormData();
    form.append("file", { uri, name, type: mimeType } as any);
    const res = await api.post("/mobile/assignments/attachments", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data as { id: string; name: string; mimeType: string; size: number };
  },
  downloadAssignmentFile: async (docId: string, fileName: string) => {
    const { accessToken } = await getTokens();
    const base = (api.defaults.baseURL || "").replace(/\/$/, "");
    const url = `${base}/mobile/assignments/attachments/${docId}`;
    const target = `${(FileSystem.cacheDirectory || "")}assignment-${docId}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const result = await FileSystem.downloadAsync(url, target, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    return result.uri;
  },
  teacherAssignments: () => get<any[]>("/mobile/teacher/assignments"),
  teacherSubmissions: (id: string, params?: { status?: string; search?: string }) =>
    get<{ assignment: any; students: any[]; stats: any }>(`/mobile/teacher/assignments/${id}/submissions`, params as any),
  gradeAssignment: (id: string, updates: { studentId: string; marksObtained?: number; feedback?: string; status?: string }[]) =>
    api.patch(`/mobile/teacher/assignments/${id}/grade`, { updates }).then((r) => r.data.data),
  publishAssignmentGrades: (id: string, studentIds?: string[]) =>
    api.post(`/mobile/teacher/assignments/${id}/publish-grades`, { studentIds }).then((r) => r.data.data),
  createFullAssignment: (payload: Record<string, unknown>) =>
    api.post("/academics/assignments", payload).then((r) => r.data),
  transitionAssignment: (id: string, action: "publish" | "close" | "reopen" | "archive" | "duplicate") =>
    api.post(`/academics/assignments/${id}/${action}`).then((r) => r.data),
  // Reused operational endpoints (backend enforces permissions + tenant scope)
  roster: (classId: string, sectionId?: string, date?: string) =>
    get<{ students: any[] }>("/attendance/roster", { classId, sectionId, date }),
  markAttendanceBulk: (payload: { date: string; schoolId: string; records: any[]; classId?: string }) =>
    api.post("/attendance/bulk", payload).then((r) => r.data),
  createHomework: (payload: Record<string, unknown>) =>
    api.post("/academics/homework", payload).then((r) => r.data),
  createAssignment: (payload: Record<string, unknown>) =>
    api.post("/academics/assignments", payload).then((r) => r.data),
  examResults: (examId: string) => get<any>(`/exams/${examId}/results`),
  enterMarks: (examId: string, payload: unknown) =>
    api.post(`/exams/${examId}/marks`, payload).then((r) => r.data),
  reportCard: (examId: string) => get<any>(`/mobile/report-card/${examId}`),
  downloadReportCard: async (examId: string, admissionNumber: string) => {
    const { accessToken } = await getTokens();
    const base = (api.defaults.baseURL || "").replace(/\/$/, "");
    const url = `${base}/mobile/report-card/${examId}?format=pdf`;
    const target = `${(FileSystem.cacheDirectory || "")}report-card-${admissionNumber}-${examId.slice(0, 8)}.pdf`;
    const result = await FileSystem.downloadAsync(url, target, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    return result.uri;
  },
  marksRoster: (examId: string, examSubjectId: string) =>
    get<any>(`/mobile/teacher/exams/${examId}/roster`, { examSubjectId }),
  submitMarksReview: (examId: string, payload: { examSubjectId: string; studentIds?: string[] }) =>
    api.post(`/mobile/teacher/exams/${examId}/marks/submit`, payload).then((r) => r.data),
};
