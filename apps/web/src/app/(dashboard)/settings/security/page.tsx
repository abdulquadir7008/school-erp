"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, KeyRound, Fingerprint, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api, getErrorMessage } from "@/lib/api";
import { useSettings } from "@/hooks/use-settings";
import { useI18n } from "@/components/language-provider";

export default function SettingsSecurityPage() {
  const { data, isLoading, isError, refetch, update, isSaving } = useSettings();
  const { t } = useI18n();

  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [strongPasswords, setStrongPasswords] = useState(true);
  const [passwordExpiryDays, setPasswordExpiryDays] = useState(90);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5);
  const [hydrated, setHydrated] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (data && !hydrated) {
      setRequireTwoFactor(Boolean(data.security.requireTwoFactor));
      setStrongPasswords(Boolean(data.security.strongPasswords !== false));
      setPasswordExpiryDays(data.security.passwordExpiryDays ?? 90);
      setSessionTimeoutMinutes(data.security.sessionTimeoutMinutes ?? 30);
      setMaxLoginAttempts(data.security.maxLoginAttempts ?? 5);
      setHydrated(true);
    }
  }, [data, hydrated]);

  const profileQuery = useQuery({
    queryKey: ["auth-profile"],
    queryFn: async () => (await api.get("/auth/profile")).data.data,
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () =>
      api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      toast.success(t("settings.security.changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading)
    return <LoadingState label={t("settings.security.loading")} />;
  if (isError)
    return (
      <ErrorState message={t("toast.failed")} onRetry={() => refetch()} />
    );

  const handleSave = async () => {
    await update({
      security: {
        requireTwoFactor,
        strongPasswords,
        passwordExpiryDays: Number(passwordExpiryDays),
        sessionTimeoutMinutes: Number(sessionTimeoutMinutes),
        maxLoginAttempts: Number(maxLoginAttempts),
      },
    });
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast.error(t("settings.security.tooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.security.mismatch"));
      return;
    }
    changePasswordMutation.mutate();
  };

  const twoFactorEnabled = profileQuery.data?.twoFactorEnabled;
  const canSubmitPassword =
    currentPassword && newPassword && newPassword === confirmPassword;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Shield className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.security.policyTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.security.policySubtitle")}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-slate-200 p-4">
              <div>
                <p className="font-medium text-slate-800">
                  {t("settings.security.require2fa")}
                </p>
                <p className="text-sm text-slate-500">
                  {t("settings.security.require2faDesc")}
                </p>
              </div>
              <Switch
                checked={requireTwoFactor}
                onChange={(e) => setRequireTwoFactor(e.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 p-4">
              <div>
                <p className="font-medium text-slate-800">
                  {t("settings.security.strongPasswords")}
                </p>
                <p className="text-sm text-slate-500">
                  {t("settings.security.strongPasswordsDesc")}
                </p>
              </div>
              <Switch
                checked={strongPasswords}
                onChange={(e) => setStrongPasswords(e.target.checked)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.security.passwordExpiry")}
              </label>
              <Input
                type="number"
                min={0}
                value={passwordExpiryDays}
                onChange={(e) => setPasswordExpiryDays(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-slate-500">
                {t("settings.security.noExpiry")}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.security.sessionTimeout")}
              </label>
              <Input
                type="number"
                min={5}
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.security.maxLoginAttempts")}
              </label>
              <Input
                type="number"
                min={3}
                value={maxLoginAttempts}
                onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-slate-500">
                {t("settings.security.lockNote")}
              </p>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button onClick={handleSave} disabled={isSaving || !hydrated}>
              {isSaving ? t("common.saving") : t("settings.security.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Fingerprint className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.security.accountTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.security.accountSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-200 p-4">
            <div>
              <p className="font-medium text-slate-800">
                {t("settings.security.twoFactor")}
              </p>
              <p className="text-sm text-slate-500">
                {t("settings.security.account2faDesc")}
              </p>
            </div>
            <Badge
              variant={twoFactorEnabled ? "success" : "secondary"}
              className="capitalize"
            >
              {twoFactorEnabled
                ? t("settings.security.twoFactorEnabled")
                : t("settings.security.notEnabled")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <KeyRound className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.security.changeTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.security.changeSubtitle")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.security.currentPassword")}
              </label>
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.security.newPassword")}
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.security.confirmPassword")}
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />{" "}
              {t("settings.security.mismatch")}
            </p>
          )}

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button
              onClick={changePassword}
              disabled={
                changePasswordMutation.isPending ||
                !canSubmitPassword ||
                newPassword !== confirmPassword
              }
            >
              {changePasswordMutation.isPending
                ? t("common.updating")
                : t("common.update")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
