"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  Wallet,
  FileText,
  Library,
  Bus,
  Building2,
  Package,
  BarChart3,
  Settings,
  School,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.students", href: "/students", icon: Users },
  { labelKey: "nav.parents", href: "/parents", icon: GraduationCap },
  { labelKey: "nav.teachers", href: "/teachers", icon: BookOpen },
  { labelKey: "nav.academics", href: "/academics", icon: Building2 },
  { labelKey: "nav.attendance", href: "/attendance", icon: CalendarCheck },
  { labelKey: "nav.fees", href: "/fees", icon: Wallet },
  { labelKey: "nav.exams", href: "/exams", icon: FileText },
  { labelKey: "nav.library", href: "/library", icon: Library },
  { labelKey: "nav.route", href: "/transport", icon: Bus },
  { labelKey: "nav.hr", href: "/hr", icon: Building2 },
  { labelKey: "nav.inventory", href: "/inventory", icon: Package },
  { labelKey: "nav.reports", href: "/reports", icon: BarChart3 },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((state) => state.user);
  const { t, isRTL } = useI18n();
  const isSuperAdmin = user?.roleName === "SUPER_ADMIN";

  const items = isSuperAdmin
    ? [
        { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
        { labelKey: "nav.schools", href: "/schools", icon: School },
        ...navItems.filter((i) => i.href !== "/dashboard"),
      ]
    : navItems;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 start-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-white">{t("nav.brandName")}</p>
              <p className="text-[10px] text-slate-400">{t("nav.brandSub")}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-700/50 hover:text-white"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              isRTL ? collapsed && "-rotate-180" : collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          const label = t(item.labelKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center",
                active
                  ? "bg-primary-600/20 text-primary-300"
                  : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700">
            <span className="text-sm font-semibold text-white">
              {user?.firstName?.[0] || "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-slate-400">
                {user?.roleName === "SUPER_ADMIN"
                  ? t("nav.platformAdmin")
                  : user?.roleName}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
