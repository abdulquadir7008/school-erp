import { api, ApiEnvelope } from "./client";

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
};
