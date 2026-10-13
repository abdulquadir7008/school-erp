import React from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`rounded-2xl bg-white p-4 shadow-sm shadow-slate-200 ${className}`}>{children}</View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-2 mt-4 text-base font-bold text-slate-900">{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm text-slate-500">{children}</Text>;
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View className="flex-1 rounded-2xl bg-white p-3 shadow-sm shadow-slate-200">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="mt-1 text-xl font-bold text-slate-900">{value}</Text>
      {!!sub && <Text className="mt-0.5 text-xs text-slate-400">{sub}</Text>}
    </View>
  );
}

export function LoadingView({ message = "Loading…" }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-[#f6f8f6] p-6">
      <ActivityIndicator size="large" color="#1a7a1a" />
      <Text className="mt-3 text-sm text-slate-500">{message}</Text>
    </View>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} className="h-20 rounded-2xl bg-slate-200/70" />
      ))}
    </View>
  );
}

export function EmptyView({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="items-center justify-center rounded-2xl bg-white p-8">
      <Text className="text-base font-semibold text-slate-700">{title}</Text>
      {!!hint && <Text className="mt-1 text-center text-sm text-slate-400">{hint}</Text>}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="items-center justify-center rounded-2xl bg-white p-8">
      <Text className="text-base font-semibold text-red-600">Something went wrong</Text>
      <Text className="mt-1 text-center text-sm text-slate-500">{message}</Text>
      {!!onRetry && (
        <Text className="mt-3 text-sm font-semibold text-primary-600" onPress={onRetry}>
          Tap to retry
        </Text>
      )}
    </View>
  );
}

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-[#f6f8f6]"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#1a7a1a" />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Pill({ text, tone = "slate" }: { text: string; tone?: "green" | "red" | "amber" | "blue" | "slate" }) {
  const tones: Record<string, string> = {
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${tones[tone]}`}>
      <Text className="text-xs font-semibold">{text}</Text>
    </View>
  );
}

export function statusTone(status: string): "green" | "red" | "amber" | "blue" | "slate" {
  const s = status?.toUpperCase();
  if (["PRESENT", "PAID", "ACTIVE", "PUBLISHED", "RETURNED", "APPROVED"].includes(s)) return "green";
  if (["ABSENT", "OVERDUE", "FAILED", "F"].includes(s)) return "red";
  if (["LATE", "HALF_DAY", "PARTIAL", "PENDING", "ISSUED"].includes(s)) return "amber";
  return "blue";
}
