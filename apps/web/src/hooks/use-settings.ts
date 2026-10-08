"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";

export interface SchoolProfile {
  id: string;
  name: string;
  schoolCode: string;
  registrationNo: string | null;
  logo: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  timezone: string;
  currency: string;
  website: string | null;
  principalName: string | null;
  status: string;
}

export interface SettingsData {
  school: SchoolProfile;
  branding: Record<string, unknown> & { tagline?: string; primaryColor?: string; accentColor?: string; logo?: string; themeMode?: string };
  general: Record<string, unknown> & { timezone?: string; currency?: string; language?: string; attendanceGraceMinutes?: number; feeReminderDays?: number };
  security: Record<string, unknown> & { requireTwoFactor?: boolean; passwordExpiryDays?: number; sessionTimeoutMinutes?: number; maxLoginAttempts?: number; strongPasswords?: boolean };
  email: Record<string, unknown> & {
    provider?: string; host?: string; port?: number | string; secure?: boolean;
    username?: string; password?: string; fromEmail?: string; fromName?: string;
    feeReceipts?: boolean; examResults?: boolean; announcements?: boolean;
  };
  whatsapp: Record<string, unknown> & {
    enabled?: boolean; provider?: string; apiKey?: string; senderId?: string;
    businessNumber?: string; feeReminders?: boolean; attendanceAlerts?: boolean;
  };
  notifications: Record<string, unknown> & {
    inApp?: boolean; email?: boolean; sms?: boolean; push?: boolean;
    feeDue?: boolean; attendance?: boolean; examResults?: boolean;
    announcements?: boolean; leaveRequests?: boolean;
  };
  payment: Record<string, unknown> & {
    gateway?: string; razorpayKeyId?: string; razorpayKeySecret?: string;
    stripeSecretKey?: string; stripePublishableKey?: string;
  };
}

export function useSettings() {
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const schoolId = user?.school?.id || user?.schoolId || "";
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const queryKey = ["settings", schoolId || "none"];

  const query = useQuery<SettingsData>({
    queryKey,
    queryFn: async () => {
      const params = isSuperAdmin && schoolId ? { schoolId } : {};
      const response = await api.get("/settings", { params });
      return response.data.data;
    },
    enabled: Boolean(schoolId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const params = isSuperAdmin && schoolId ? `?schoolId=${schoolId}` : "";
      const response = await api.put(`/settings${params}`, patch);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("toast.saved"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const params = isSuperAdmin && schoolId ? `?schoolId=${schoolId}` : "";
      const response = await api.put(`/settings/profile${params}`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("toast.updated"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    update: updateMutation.mutateAsync,
    updateProfile: updateProfileMutation.mutateAsync,
    isSaving: updateMutation.isPending || updateProfileMutation.isPending,
    schoolId,
    isSuperAdmin,
  };
}