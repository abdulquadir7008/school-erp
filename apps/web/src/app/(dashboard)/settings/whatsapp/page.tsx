"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Send, Save, Phone } from "lucide-react";
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

export default function SettingsWhatsappPage() {
  const { data, isLoading, isError, refetch, update, isSaving } = useSettings();
  const { t } = useI18n();

  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("gupshup");
  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [feeReminders, setFeeReminders] = useState(true);
  const [attendanceAlerts, setAttendanceAlerts] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      setEnabled(Boolean(data.whatsapp.enabled));
      setProvider(data.whatsapp.provider || "gupshup");
      setApiKey(data.whatsapp.apiKey || "");
      setSenderId(data.whatsapp.senderId || "");
      setBusinessNumber(data.whatsapp.businessNumber || "");
      setFeeReminders(data.whatsapp.feeReminders !== false);
      setAttendanceAlerts(data.whatsapp.attendanceAlerts !== false);
      setHydrated(true);
    }
  }, [data, hydrated]);

  const testMutation = useMutation({
    mutationFn: async (to: string) =>
      api.post("/settings/send-test", { channel: "whatsapp", to }),
    onSuccess: () => toast.success(t("settings.whatsapp.testSent")),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading)
    return <LoadingState label={t("settings.whatsapp.loading")} />;
  if (isError)
    return (
      <ErrorState
        message={t("toast.failed")}
        onRetry={() => refetch()}
      />
    );

  const handleSave = async () => {
    await update({
      whatsapp: {
        enabled,
        provider,
        apiKey,
        senderId,
        businessNumber,
        feeReminders,
        attendanceAlerts,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <MessageSquare className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.whatsapp.title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.whatsapp.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-200 p-4">
            <div>
              <p className="font-medium text-slate-800">
                {t("settings.whatsapp.enabled")}
              </p>
              <p className="text-sm text-slate-500">
                {t("settings.whatsapp.enabledDesc")}
              </p>
            </div>
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.whatsapp.provider")}
              </label>
              <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="gupshup">Gupshup</option>
                <option value="twilio">Twilio WhatsApp</option>
                <option value="messagebird">MessageBird</option>
                <option value="interakt">Interakt</option>
                <option value="whatsapp-cloud">WhatsApp Cloud API</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.whatsapp.apiKey")}
              </label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                placeholder="••••••••••••"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.whatsapp.senderId")}
              </label>
              <Input
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="SCHOOL (6-11 alphanumeric chars)"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.whatsapp.businessNumber")}
              </label>
              <Input
                value={businessNumber}
                onChange={(e) => setBusinessNumber(e.target.value)}
                placeholder={t("settings.whatsapp.testPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              {t("settings.whatsapp.autoMessages")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  label: t("settings.whatsapp.feeReminders"),
                  value: feeReminders,
                  set: setFeeReminders,
                },
                {
                  label: t("settings.whatsapp.attendanceAlerts"),
                  value: attendanceAlerts,
                  set: setAttendanceAlerts,
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
              {isSaving ? t("common.saving") : t("settings.whatsapp.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t("settings.whatsapp.testTitle")}
            </h3>
            <p className="text-sm text-slate-500">
              {t("settings.whatsapp.tryDesc")}
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder={t("settings.whatsapp.testPlaceholder")}
            />
            <Button
              variant="outline"
              className="shrink-0"
              disabled={testMutation.isPending || !testTo}
              onClick={() => testMutation.mutate(testTo)}
            >
              <Send className="mr-2 h-4 w-4" />
              {testMutation.isPending ? t("common.sending") : t("common.send")}
            </Button>
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Phone className="h-3.5 w-3.5" />
            {t("settings.whatsapp.simulatedNote")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
