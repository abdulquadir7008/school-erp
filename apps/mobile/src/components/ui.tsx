import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------- Layout ----------

export function Screen({
  children,
  refreshing,
  onRefresh,
  padded = true,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}) {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: padded ? 16 : 0, paddingBottom: 36 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

// ---------- Typography ----------

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-2 mt-5 text-[15px] font-extrabold tracking-tight text-ink">{children}</Text>;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="mb-2 mt-5 flex-row items-end justify-between">
      <View className="flex-1">
        <Text className="text-[15px] font-extrabold tracking-tight text-ink">{title}</Text>
        {!!subtitle && <Text className="mt-0.5 text-xs text-slate-500">{subtitle}</Text>}
      </View>
      {!!actionLabel && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-xs font-bold text-primary-600">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text className="text-[13px] leading-5 text-slate-500">{children}</Text>;
}

// ---------- Cards ----------

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <View
      className={`rounded-[20px] border border-slate-100 bg-white p-4 ${className}`}
      style={{ shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }}
    >
      {children}
    </View>
  );
}

export function HeroCard({
  eyebrow,
  title,
  subtitle,
  meta,
  deep = "#1E1B4B",
  accent = "#F59E0B",
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  meta?: string;
  deep?: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <View className="overflow-hidden rounded-[24px] p-5" style={{ backgroundColor: deep }}>
      {/* decorative blobs */}
      <View
        className="absolute -right-10 -top-14 h-40 w-40 rounded-full opacity-20"
        style={{ backgroundColor: accent }}
      />
      <View className="absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-white opacity-10" />
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/70">{eyebrow}</Text>
      <Text className="mt-1.5 text-[22px] font-extrabold leading-7 text-white">{title}</Text>
      {!!subtitle && <Text className="mt-1 text-[13px] font-medium text-white/80">{subtitle}</Text>}
      {!!meta && <Text className="mt-1 text-[11px] text-white/60">{meta}</Text>}
      {!!children && <View className="mt-3">{children}</View>}
    </View>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tint = "bg-primary-50",
  iconColor = "#4F46E5",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tint?: string;
  iconColor?: string;
}) {
  return (
    <View
      className="flex-1 rounded-[20px] border border-slate-100 bg-white p-3.5"
      style={{ shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</Text>
        {!!icon && (
          <View className={`h-7 w-7 items-center justify-center rounded-full ${tint}`}>
            <Ionicons name={icon} size={15} color={iconColor} />
          </View>
        )}
      </View>
      <Text className="mt-1.5 text-[19px] font-extrabold tracking-tight text-ink" numberOfLines={1}>
        {value}
      </Text>
      {!!sub && (
        <Text className="mt-0.5 text-[11px] font-medium text-slate-400" numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

export function QuickAction({
  label,
  hint,
  icon,
  tint,
  iconColor,
  onPress,
}: {
  label: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center rounded-[20px] border border-slate-100 bg-white px-2 py-4 active:opacity-80"
      style={{ width: "31%", shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 }}
    >
      <View className={`h-11 w-11 items-center justify-center rounded-2xl ${tint}`}>
        <Ionicons name={icon} size={21} color={iconColor} />
      </View>
      <Text className="mt-2 text-center text-[12px] font-bold text-ink">{label}</Text>
      {!!hint && <Text className="text-center text-[10px] text-slate-400">{hint}</Text>}
    </Pressable>
  );
}

export function ListRow({
  icon,
  tint,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center gap-3 bg-white px-4 py-3.5 ${last ? "" : "border-b border-slate-100"} active:bg-slate-50`}
    >
      <View className={`h-10 w-10 items-center justify-center rounded-2xl ${tint}`}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-bold text-ink" numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text className="mt-0.5 text-[12px] text-slate-500" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? (!!onPress && <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />)}
    </Pressable>
  );
}

export function Avatar({ name, size = 44, bg = "#4F46E5" }: { name: string; size?: number; bg?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <Text className="font-extrabold text-white" style={{ fontSize: size * 0.36 }}>
        {initials || "•"}
      </Text>
    </View>
  );
}

// ---------- Status ----------

export function Pill({ text, tone = "slate" }: { text: string; tone?: "green" | "red" | "amber" | "blue" | "slate" | "violet" | "teal" }) {
  const tones: Record<string, string> = {
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
    slate: "bg-slate-100 text-slate-700",
    violet: "bg-violet-100 text-violet-800",
    teal: "bg-teal-100 text-teal-800",
  };
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${tones[tone]}`}>
      <Text className="text-[11px] font-bold">{text}</Text>
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

export function ProgressBar({ value, total, color = "#4F46E5" }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <View className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
      <View className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </View>
  );
}

// ---------- States ----------

export function LoadingView({ message = "Loading…" }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-canvas p-6">
      <View className="h-14 w-14 items-center justify-center rounded-3xl bg-primary-600">
        <ActivityIndicator size="small" color="#fff" />
      </View>
      <Text className="mt-4 text-[13px] font-semibold text-slate-500">{message}</Text>
    </View>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-2.5 p-4">
      <View className="h-32 rounded-[24px] bg-slate-200/60" />
      <View className="flex-row gap-2.5">
        <View className="h-24 flex-1 rounded-[20px] bg-slate-200/60" />
        <View className="h-24 flex-1 rounded-[20px] bg-slate-200/60" />
        <View className="h-24 flex-1 rounded-[20px] bg-slate-200/60" />
      </View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} className="h-20 rounded-[20px] bg-slate-200/60" />
      ))}
    </View>
  );
}

export function EmptyView({
  title,
  hint,
  icon = "sparkles-outline",
}: {
  title: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white p-8">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <Ionicons name={icon} size={22} color="#94A3B8" />
      </View>
      <Text className="mt-3 text-[14px] font-bold text-ink">{title}</Text>
      {!!hint && <Text className="mt-1 text-center text-[12px] leading-5 text-slate-400">{hint}</Text>}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="items-center justify-center rounded-[20px] border border-red-100 bg-white p-8">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
        <Ionicons name="cloud-offline-outline" size={22} color="#DC2626" />
      </View>
      <Text className="mt-3 text-[14px] font-bold text-ink">Something went wrong</Text>
      <Text className="mt-1 text-center text-[12px] text-slate-500">{message}</Text>
      {!!onRetry && (
        <Pressable onPress={onRetry} className="mt-4 rounded-full bg-ink px-5 py-2.5 active:opacity-80">
          <Text className="text-[12px] font-bold text-white">Tap to retry</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------- Buttons / inputs ----------

export function PrimaryButton({
  label,
  onPress,
  disabled,
  color = "#4F46E5",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="items-center rounded-2xl py-4 active:opacity-85"
      style={{ backgroundColor: disabled ? "#C7D2FE" : color }}
    >
      <Text className="text-[15px] font-extrabold text-white">{label}</Text>
    </Pressable>
  );
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
