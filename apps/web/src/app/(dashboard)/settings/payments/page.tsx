"use client";

import { useEffect, useState } from "react";
import { CreditCard, Landmark, Save, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { useSettings } from "@/hooks/use-settings";
import { useI18n } from "@/components/language-provider";

export default function SettingsPaymentsPage() {
  const { data, isLoading, isError, refetch, update, isSaving } = useSettings();
  const { t } = useI18n();

  const [gateway, setGateway] = useState("razorpay");
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      setGateway(data.payment.gateway || "razorpay");
      setRazorpayKeyId(data.payment.razorpayKeyId || "");
      setRazorpayKeySecret(data.payment.razorpayKeySecret || "");
      setStripeSecretKey(data.payment.stripeSecretKey || "");
      setStripePublishableKey(data.payment.stripePublishableKey || "");
      setHydrated(true);
    }
  }, [data, hydrated]);

  if (isLoading)
    return <LoadingState label={t("settings.payments.loading")} />;
  if (isError)
    return (
      <ErrorState
        message={t("toast.failed")}
        onRetry={() => refetch()}
      />
    );

  const handleSave = async () => {
    await update({
      payment: {
        gateway,
        razorpayKeyId,
        razorpayKeySecret,
        stripeSecretKey,
        stripePublishableKey,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <CreditCard className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t("settings.payments.title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("settings.payments.subtitle")}
              </p>
            </div>
          </div>

          <div className="sm:max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("settings.payments.defaultGateway")}
            </label>
            <Select value={gateway} onChange={(e) => setGateway(e.target.value)}>
              <option value="razorpay">{t("settings.payments.razorpay")}</option>
              <option value="stripe">{t("settings.payments.stripe")}</option>
              <option value="offline">{t("settings.payments.offline")}</option>
            </Select>
          </div>

          <div
            className={`rounded-lg border p-4 ${
              gateway === "razorpay" ? "border-primary-200 bg-primary-50/30" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
                <Zap className="h-4 w-4 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-slate-800">
                  {t("settings.payments.razorpay")}
                </p>
                <p className="text-sm text-slate-500">
                  {t("settings.payments.razorpayDesc")}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("settings.payments.keyId")}
                </label>
                <Input
                  type="password"
                  value={razorpayKeyId}
                  onChange={(e) => setRazorpayKeyId(e.target.value)}
                  autoComplete="off"
                  placeholder="rzp_live_..."
                  disabled={gateway !== "razorpay"}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("settings.payments.keySecret")}
                </label>
                <Input
                  type="password"
                  value={razorpayKeySecret}
                  onChange={(e) => setRazorpayKeySecret(e.target.value)}
                  autoComplete="off"
                  placeholder="••••••••••••"
                  disabled={gateway !== "razorpay"}
                />
              </div>
            </div>
          </div>

          <div
            className={`rounded-lg border p-4 ${
              gateway === "stripe" ? "border-primary-200 bg-primary-50/30" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
                <Landmark className="h-4 w-4 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-slate-800">
                  {t("settings.payments.stripe")}
                </p>
                <p className="text-sm text-slate-500">
                  {t("settings.payments.stripeDesc")}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("settings.payments.secretKey")}
                </label>
                <Input
                  type="password"
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  autoComplete="off"
                  placeholder="sk_live_..."
                  disabled={gateway !== "stripe"}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("settings.payments.publishableKey")}
                </label>
                <Input
                  type="password"
                  value={stripePublishableKey}
                  onChange={(e) => setStripePublishableKey(e.target.value)}
                  autoComplete="off"
                  placeholder="pk_live_..."
                  disabled={gateway !== "stripe"}
                />
              </div>
            </div>
          </div>

          <p className="rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-500">
            {t("settings.payments.keysNote")}
          </p>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button onClick={handleSave} disabled={isSaving || !hydrated}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? t("common.saving") : t("settings.payments.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
