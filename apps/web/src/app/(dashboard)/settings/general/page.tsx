"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { api } from "@/lib/api";
import { useSettings } from "@/hooks/use-settings";
import { useI18n } from "@/components/language-provider";
import { LANGUAGES, SUPPORTED_LANGS, isLang } from "@/lib/i18n";

export default function SettingsGeneralPage() {
  const { data, isLoading, isError, refetch, update, isSaving } = useSettings();
  const { t, applySchoolDefault } = useI18n();

  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [language, setLanguage] = useState("en");
  const [attendanceGraceMinutes, setAttendanceGraceMinutes] = useState(10);
  const [feeReminderDays, setFeeReminderDays] = useState(3);
  const [hydrated, setHydrated] = useState(false);

  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const response = await api.get("/fees/academic-years");
      return response.data.data;
    },
  });

  useEffect(() => {
    if (data && !hydrated) {
      setTimezone(data.general.timezone || "Asia/Kolkata");
      setCurrency(data.general.currency || "INR");
      setLanguage(data.general.language || "en");
      setAttendanceGraceMinutes(
        data.general.attendanceGraceMinutes ?? 10
      );
      setFeeReminderDays(data.general.feeReminderDays ?? 3);
      setHydrated(true);
    }
  }, [data, hydrated]);

  if (isLoading) return <LoadingState label={t("settings.general.loading")} />;
  if (isError)
    return (
      <ErrorState message={t("toast.failed")} onRetry={() => refetch()} />
    );

  const handleSave = async () => {
    await update({
      general: {
        timezone,
        currency,
        language,
        attendanceGraceMinutes: Number(attendanceGraceMinutes),
        feeReminderDays: Number(feeReminderDays),
      },
    });
    if (isLang(language)) {
      applySchoolDefault(language);
    }
  };

  const years = yearsQuery.data || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Globe className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.general.title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.general.subtitle")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.general.timezone")}
              </label>
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {[
                  ["Asia/Kolkata", "IST - Asia/Kolkata (UTC+5:30)"],
                  ["Asia/Dubai", "GST - Asia/Dubai (UTC+4)"],
                  ["Asia/Singapore", "SGT - Asia/Singapore (UTC+8)"],
                  ["Asia/Dhaka", "BST - Asia/Dhaka (UTC+6)"],
                  ["Asia/Kathmandu", "NPT - Asia/Kathmandu (UTC+5:45)"],
                  ["Africa/Nairobi", "EAT - Africa/Nairobi (UTC+3)"],
                  ["Europe/London", "GMT - Europe/London (UTC+0)"],
                  ["America/New_York", "EST - America/New_York (UTC-5)"],
                  ["Australia/Sydney", "AEST - Australia/Sydney (UTC+10)"],
                  ["UTC", "UTC (Coordinated Universal Time)"],
                ].map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.general.currency")}
              </label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {[
                  ["INR", "INR - Indian Rupee (₹)"],
                  ["USD", "USD - US Dollar ($)"],
                  ["AED", "AED - UAE Dirham (د.إ)"],
                  ["SGD", "SGD - Singapore Dollar (S$)"],
                  ["GBP", "GBP - British Pound (£)"],
                  ["EUR", "EUR - Euro (€)"],
                  ["BDT", "BDT - Bangladeshi Taka (৳)"],
                  ["NPR", "NPR - Nepalese Rupee (रू)"],
                ].map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.general.language")}
              </label>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {SUPPORTED_LANGS.map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGES[code].nativeLabel}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-500">
                {t("settings.general.languageDesc")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.general.attendanceGrace")}
              </label>
              <Input
                type="number"
                min={0}
                max={60}
                value={attendanceGraceMinutes}
                onChange={(e) => setAttendanceGraceMinutes(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-slate-500">
                {t("settings.general.attendanceGraceDesc")}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.general.feeReminder")}
              </label>
              <Input
                type="number"
                min={0}
                max={30}
                value={feeReminderDays}
                onChange={(e) => setFeeReminderDays(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-slate-500">
                {t("settings.general.feeReminderDesc")}
              </p>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button onClick={handleSave} disabled={isSaving || !hydrated}>
              {isSaving ? t("common.saving") : t("settings.general.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100">
              <CalendarRange className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {t("settings.general.academicYears")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("settings.general.academicYearsDesc")}
              </p>
            </div>
          </div>
          {yearsQuery.isLoading ? (
            <LoadingState label={t("settings.general.loadingYears")} className="py-6" />
          ) : years.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">
              {t("settings.general.noAcademicYears")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {years.map((year: any) => (
                <Badge
                  key={year.id}
                  variant={year.isCurrent ? "success" : "secondary"}
                >
                  {year.name}
                  {year.isCurrent ? ` ${t("settings.general.current")}` : ""} ·{" "}
                  {t("settings.general.started")}{" "}
                  {new Date(year.startDate).toLocaleDateString()}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}