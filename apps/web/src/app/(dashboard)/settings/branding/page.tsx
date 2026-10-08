"use client";

import { useEffect, useState } from "react";
import { Palette, Upload, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { useSettings } from "@/hooks/use-settings";
import { useI18n } from "@/components/language-provider";

const PRESETS = [
  { name: "Indigo", color: "#4f46e5" },
  { name: "Royal Blue", color: "#2563eb" },
  { name: "Emerald", color: "#059669" },
  { name: "Crimson", color: "#dc2626" },
  { name: "Amber", color: "#d97706" },
  { name: "Teal", color: "#0d9488" },
];

export default function SettingsBrandingPage() {
  const { data, isLoading, isError, refetch, update, isSaving } = useSettings();
  const { t } = useI18n();

  const [logo, setLogo] = useState("");
  const [tagline, setTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [accentColor, setAccentColor] = useState("#0ea5e9");
  const [themeMode, setThemeMode] = useState("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      setLogo(data.branding.logo || data.school.logo || "");
      setTagline(data.branding.tagline || "");
      setPrimaryColor(data.branding.primaryColor || "#4f46e5");
      setAccentColor(data.branding.accentColor || "#0ea5e9");
      setThemeMode(data.branding.themeMode || "light");
      setHydrated(true);
    }
  }, [data, hydrated]);

  if (isLoading)
    return <LoadingState label={t("settings.branding.loading")} />;
  if (isError)
    return (
      <ErrorState message={t("toast.failed")} onRetry={() => refetch()} />
    );

  const handleSave = async () => {
    await update({
      branding: {
        logo,
        tagline,
        primaryColor,
        accentColor,
        themeMode,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Palette className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.branding.title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.branding.subtitle")}
              </p>
            </div>
          </div>

          {/* Live preview */}
          <div
            className="rounded-xl border p-5"
            style={{ backgroundColor: (primaryColor || "#4f46e5") + "0d" }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {(data?.school.name?.[0] || "S").toUpperCase()}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {data?.school.name}
                </p>
                <p className="text-sm" style={{ color: accentColor }}>
                  {tagline || t("settings.branding.livePreviewFallback")}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("settings.branding.logoLabel")}
            </label>
            <div className="flex items-center gap-4 rounded-md border border-dashed border-slate-300 p-4">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt="School logo"
                  className="h-14 w-14 rounded-lg object-contain"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-xl font-semibold text-slate-400">
                  {(data?.school.name?.[0] || "S").toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">
                  {t("settings.branding.logoUrlTitle")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("settings.branding.logoUrlDesc")}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Input
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://cdn.example.com/logo.png"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("settings.branding.tagline")}
            </label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Empowering minds, shaping futures"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.branding.primaryColor")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-slate-200 bg-transparent p-1"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    onClick={() => setPrimaryColor(preset.color)}
                    className="h-6 w-6 rounded-full border border-slate-200 transition-transform hover:scale-110"
                    style={{ backgroundColor: preset.color }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("settings.branding.accentColor")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-slate-200 bg-transparent p-1"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div className="sm:max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("settings.branding.defaultTheme")}
            </label>
            <Select value={themeMode} onChange={(e) => setThemeMode(e.target.value)}>
              <option value="light">{t("settings.branding.themeLight")}</option>
              <option value="dark">{t("settings.branding.themeDark")}</option>
              <option value="system">{t("settings.branding.followSystem")}</option>
            </Select>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4" />
              {t("settings.branding.reflectedNote")}
            </div>
            <Button onClick={handleSave} disabled={isSaving || !hydrated}>
              {isSaving ? t("common.saving") : t("settings.branding.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm font-medium text-slate-800">
              {t("settings.branding.uploadTitle")}
            </p>
            <p className="text-xs text-slate-500">
              {t("settings.branding.uploadDesc")}
            </p>
          </div>
          <Button variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" />
            {t("settings.branding.upload")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
