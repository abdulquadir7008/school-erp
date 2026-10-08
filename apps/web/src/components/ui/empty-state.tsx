"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/components/language-provider";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Inbox className="h-7 w-7 text-slate-400" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-800">
          {title ?? t("common.noItems")}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}