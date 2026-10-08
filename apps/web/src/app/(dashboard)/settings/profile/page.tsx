"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useSettings } from "@/hooks/use-settings";
import { useI18n } from "@/components/language-provider";

export default function SettingsProfilePage() {
  const { data, isLoading, isError, refetch, updateProfile, isSaving, schoolId } =
    useSettings();
  const { t } = useI18n();

  const [form, setForm] = useState({
    name: "",
    registrationNo: "",
    email: "",
    phone: "",
    website: "",
    principalName: "",
    address: "",
    city: "",
    state: "",
    country: "",
    timezone: "",
    currency: "",
  });

  // Hydrate the form once data arrives
  const [hydrated, setHydrated] = useState(false);
  if (data && !hydrated) {
    const s = data.school;
    setForm({
      name: s.name || "",
      registrationNo: s.registrationNo || "",
      email: s.email || "",
      phone: s.phone || "",
      website: s.website || "",
      principalName: s.principalName || "",
      address: s.address || "",
      city: s.city || "",
      state: s.state || "",
      country: s.country || "",
      timezone: s.timezone || "Asia/Kolkata",
      currency: s.currency || "INR",
    });
    setHydrated(true);
  }

  const updateField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      country: form.country || undefined,
      timezone: form.timezone || undefined,
      currency: form.currency || undefined,
      website: form.website || undefined,
      principalName: form.principalName || undefined,
      registrationNo: form.registrationNo || undefined,
    };
    await updateProfile(payload);
  };

  if (isLoading)
    return <LoadingState label={t("settings.profile.loading")} />;
  if (isError)
    return (
      <ErrorState message={t("toast.failed")} onRetry={() => refetch()} />
    );
  if (!schoolId)
    return (
      <EmptyState
        title={t("settings.profile.noSchool")}
        description={t("settings.profile.noSchoolDesc")}
      />
    );

  const field = (
    key: string,
    label: string,
    placeholder: string,
    props: {
      type?: "text" | "email" | "url" | "tel";
      inputMode?: "email" | "url";
    } = {}
  ) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <Input
        value={(form as any)[key] ?? ""}
        onChange={(e) => updateField(key, e.target.value)}
        placeholder={placeholder}
        {...props}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.profile.title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.profile.subtitle")}
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-100 text-xl font-semibold text-primary-600">
              {data?.school.name?.[0] || <Building2 className="h-6 w-6" />}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field(
              "name",
              t("settings.profile.schoolName"),
              "e.g. Greenfield International",
              {
                type: "text",
              }
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.profile.schoolCode")}
              </label>
              <Input value={data?.school.schoolCode || ""} disabled />
            </div>
            {field(
              "registrationNo",
              t("settings.profile.registrationNo"),
              "e.g. AFF-2024-0042"
            )}
            {field(
              "email",
              t("settings.profile.officialEmail"),
              t("settings.profile.schoolEmailPlaceholder"),
              { type: "email", inputMode: "email" }
            )}
            {field(
              "phone",
              t("settings.profile.phoneNumber"),
              t("settings.profile.phonePlaceholder")
            )}
            {field(
              "website",
              t("settings.profile.website"),
              t("settings.profile.websitePlaceholder"),
              { type: "url", inputMode: "url" }
            )}
            {field(
              "principalName",
              t("settings.profile.principalName"),
              "Dr. Jane Doe"
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("settings.profile.address")}
            </label>
            <Input
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Street, area, landmark"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {field("city", t("settings.profile.city"), "e.g. Bengaluru")}
            {field("state", t("settings.profile.state"), "e.g. Karnataka")}
            {field("country", t("settings.profile.country"), "e.g. India")}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.profile.timezone")}
              </label>
              <Select
                value={form.timezone}
                onChange={(e) => updateField("timezone", e.target.value)}
              >
                {[
                  "Asia/Kolkata",
                  "Asia/Dubai",
                  "Asia/Singapore",
                  "Europe/London",
                  "America/New_York",
                  "UTC",
                ].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.profile.currency")}
              </label>
              <Select
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              >
                {[
                  ["INR", "INR - Indian Rupee (₹)"],
                  ["USD", "USD - US Dollar ($)"],
                  ["AED", "AED - UAE Dirham (د.إ)"],
                  ["SGD", "SGD - Singapore Dollar (S$)"],
                  ["GBP", "GBP - British Pound (£)"],
                  ["EUR", "EUR - Euro (€)"],
                ].map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <p className="text-sm text-slate-500">
            {t("settings.profile.footerNote")}
          </p>
          <Button onClick={handleSave} disabled={isSaving || !hydrated}>
            {isSaving
              ? t("settings.profile.saving")
              : t("settings.profile.saveChanges")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
