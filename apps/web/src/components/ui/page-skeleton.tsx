"use client";

import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200", className)}
      aria-hidden
    />
  );
}

/** Lightweight streaming fallback used by all `loading.tsx` files.
 *  Intentionally dependency-free (no i18n/hooks) so it can render
 *  before providers / page chunks finish loading (lazy-route fallback).
 */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Bar className="h-7 w-56" />
        <Bar className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <Bar className="h-4 w-24" />
            <Bar className="mt-3 h-7 w-20" />
            <Bar className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Bar key={i} className="mb-3 h-9 w-full last:mb-0" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-64 items-center justify-center rounded-lg bg-slate-50",
        className
      )}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
    </div>
  );
}
