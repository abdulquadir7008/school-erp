"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import {
  Building2,
  Palette,
  Globe,
  Shield,
  Mail,
  MessageSquare,
  Users,
  Bell,
  CreditCard,
} from "lucide-react";

const tabs = [
  { href: "/settings/profile", labelKey: "settings.tabProfile", icon: Building2 },
  { href: "/settings/branding", labelKey: "settings.tabBranding", icon: Palette },
  { href: "/settings/general", labelKey: "settings.tabGeneral", icon: Globe },
  { href: "/settings/security", labelKey: "settings.tabSecurity", icon: Shield },
  { href: "/settings/email", labelKey: "settings.tabEmail", icon: Mail },
  { href: "/settings/whatsapp", labelKey: "settings.tabWhatsapp", icon: MessageSquare },
  { href: "/settings/roles", labelKey: "settings.tabRoles", icon: Users },
  { href: "/settings/notifications", labelKey: "settings.tabNotifications", icon: Bell },
  { href: "/settings/payments", labelKey: "settings.tabPayments", icon: CreditCard },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (pathname === "/settings") {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("settings.title")}</h1>
        <p className="text-sm text-slate-500">{t("settings.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <nav className="space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="lg:col-span-3">{children}</div>
      </div>
    </div>
  );
}