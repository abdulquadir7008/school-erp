"use client";

import { Button } from "./button";
import { useI18n } from "@/components/language-provider";
import { RefreshCcw, AlertTriangle } from "lucide-react";

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-800">
          {message ?? t("toast.failed")}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw className="me-2 h-4 w-4" />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
