"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Send, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Switch } from "@/components/ui/switch";
import { api, getErrorMessage } from "@/lib/api";
import { useSettings } from "@/hooks/use-settings";
import { useI18n } from "@/components/language-provider";

export default function SettingsEmailPage() {
  const { data, isLoading, isError, refetch, update, isSaving } =
    useSettings();
  const { t } = useI18n();

  const [provider, setProvider] = useState("smtp");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [feeReceipts, setFeeReceipts] = useState(true);
  const [examResults, setExamResults] = useState(true);
  const [announcements, setAnnouncements] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      setProvider(data.email.provider || "smtp");
      setHost(data.email.host || "");
      setPort(Number(data.email.port) || 587);
      setSecure(Boolean(data.email.secure));
      setUsername(data.email.username || "");
      setPassword(data.email.password || "");
      setFromEmail(data.email.fromEmail || "");
      setFromName(data.email.fromName || "");
      setFeeReceipts(data.email.feeReceipts !== false);
      setExamResults(data.email.examResults !== false);
      setAnnouncements(data.email.announcements !== false);
      setHydrated(true);
    }
  }, [data, hydrated]);

  const testMutation = useMutation({
    mutationFn: async (to: string) =>
      api.post("/settings/send-test", {
        channel: "email",
        to,
      }),
    onSuccess: () => toast.success(t("toast.sent")),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading)
    return <LoadingState label={t("settings.email.loading")} />;
  if (isError)
    return (
      <ErrorState message={t("toast.failed")} onRetry={() => refetch()} />
    );

  const handleSave = async () => {
    await update({
      email: {
        provider,
        host,
        port: Number(port),
        secure,
        username,
        password,
        fromEmail,
        fromName,
        feeReceipts,
        examResults,
        announcements,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Mail className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.email.title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.email.subtitle")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.email.provider")}
              </label>
              <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="smtp">Custom SMTP</option>
                <option value="gmail">Gmail / Google Workspace</option>
                <option value="outlook">Outlook / Microsoft 365</option>
                <option value="sendgrid">SendGrid API</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.email.host")}
              </label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.email.port")}
              </label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-md border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {t("settings.email.sslLabel")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t("settings.email.sslDesc")}
                  </p>
                </div>
                <Switch
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.email.username")}
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="no-reply@school.edu"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.email.password")}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                placeholder="••••••••••••"
              />
              <p className="mt-1 text-xs text-slate-500">
                {t("settings.email.passwordNote")}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.email.fromEmail")}
              </label>
              <Input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="no-reply@school.edu"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.email.fromName")}
              </label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Greenfield International School"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              {t("settings.email.autoSend")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  label: t("settings.email.feeReceipts"),
                  value: feeReceipts,
                  set: setFeeReceipts,
                },
                {
                  label: t("settings.email.examResults"),
                  value: examResults,
                  set: setExamResults,
                },
                {
                  label: t("settings.email.announcements"),
                  value: announcements,
                  set: setAnnouncements,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-3"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {item.label}
                  </span>
                  <Switch
                    checked={item.value}
                    onChange={(e) => item.set(e.target.checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button onClick={handleSave} disabled={isSaving || !hydrated}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? t("common.saving") : t("settings.email.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t("settings.email.testTitle")}
            </h3>
            <p className="text-sm text-slate-500">
              {t("settings.email.verifyDesc")}
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder={t("settings.email.testPlaceholder")}
            />
            <Button
              variant="outline"
              className="shrink-0"
              disabled={
                testMutation.isPending || !testTo || !host
              }
              onClick={() => testMutation.mutate(testTo)}
            >
              <Send className="mr-2 h-4 w-4" />
              {testMutation.isPending ? t("common.sending") : t("common.send")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
