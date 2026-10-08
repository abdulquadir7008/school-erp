"use client";

import { useI18n } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function LoadingState({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      <p className="text-sm">{label ?? t("common.loading")}</p>
    </div>
  );
}
