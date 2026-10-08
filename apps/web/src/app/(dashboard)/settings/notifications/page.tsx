"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, Smartphone, MonitorSmartphone, AppWindow } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/use-settings";
import { useI18n } from "@/components/language-provider";

interface ChannelConfig {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CHANNELS: ChannelConfig[] = [
  { key: "inApp", icon: AppWindow },
  { key: "email", icon: Mail },
  { key: "sms", icon: Smartphone },
  { key: "push", icon: MonitorSmartphone },
];

const EVENT_KEYS = [
  "feeDue",
  "attendance",
  "examResults",
  "announcements",
  "leaveRequests",
];

export default function SettingsNotificationsPage() {
  const { data, isLoading, isError, refetch, update, isSaving } = useSettings();
  const { t } = useI18n();

  const [channels, setChannels] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      setChannels({
        inApp: data.notifications.inApp !== false,
        email: data.notifications.email !== false,
        sms: Boolean(data.notifications.sms),
        push: Boolean(data.notifications.push),
      });
      setEvents({
        feeDue: data.notifications.feeDue !== false,
        attendance: data.notifications.attendance !== false,
        examResults: data.notifications.examResults !== false,
        announcements: data.notifications.announcements !== false,
        leaveRequests: Boolean(data.notifications.leaveRequests),
      });
      setHydrated(true);
    }
  }, [data, hydrated]);

  if (isLoading)
    return <LoadingState label={t("settings.notifications.loading")} />;
  if (isError)
    return (
      <ErrorState
        message={t("toast.failed")}
        onRetry={() => refetch()}
      />
    );

  const handleSave = async () => {
    await update({
      notifications: {
        ...channels,
        ...events,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Bell className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.notifications.preferencesTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.notifications.preferencesSubtitle")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              return (
                <div
                  key={channel.key}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {t(`settings.notifications.${channel.key}`)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {t(`settings.notifications.${channel.key}Desc`)}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(channels[channel.key])}
                    onChange={(e) =>
                      setChannels((prev) => ({
                        ...prev,
                        [channel.key]: e.target.checked,
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              {t("settings.notifications.events")}
            </h3>
            <div className="space-y-2">
              {EVENT_KEYS.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {t(`settings.notifications.${key}`)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(`settings.notifications.${key}Desc`)}
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(events[key])}
                    onChange={(e) =>
                      setEvents((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button onClick={handleSave} disabled={isSaving || !hydrated}>
              {isSaving
                ? t("common.saving")
                : t("settings.notifications.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
