"use client";

import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  change,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  change?: string;
  icon: React.ReactNode;
  iconBg?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {change && (
            <p className="mt-1 text-xs font-medium text-green-600">{change}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            iconBg || "bg-primary-50 text-primary-600"
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}