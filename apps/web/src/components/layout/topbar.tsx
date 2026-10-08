"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  User,
  LogOut,
  ChevronDown,
  Moon,
  Sun,
  Languages,
  Check,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";
import { useGlobalSearch } from "./global-search";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { LANGUAGES, SUPPORTED_LANGS } from "@/lib/i18n";

export function Topbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { openSearch } = useGlobalSearch();
  const { theme, setTheme } = useTheme();
  const { t, lang, setLang } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openSearch]);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } catch {
      // ignore logout errors
    }
    logout();
    localStorage.removeItem("schoolsphere-auth");
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
      <button
        onClick={openSearch}
        className="flex w-72 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 transition-colors hover:border-slate-300"
      >
        <Search className="h-4 w-4" />
        <span>{t("topbar.search")}</span>
        <kbd className="ms-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          {t("topbar.searchHint")}
        </kbd>
      </button>

      <div className="flex items-center gap-3">
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 rounded-md p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t("lang.switchTo")}
          >
            <Languages className="h-5 w-5" />
            <span className="hidden text-sm font-medium sm:inline">
              {LANGUAGES[lang].nativeLabel}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-slate-400 transition-transform",
                langOpen && "rotate-180"
              )}
            />
          </button>

          {langOpen && (
            <div className="absolute end-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <p className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                {t("lang.interfaceLanguage")}
              </p>
              {SUPPORTED_LANGS.map((code) => (
                <button
                  key={code}
                  onClick={() => {
                    setLang(code);
                    setLangOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <span>{LANGUAGES[code].nativeLabel}</span>
                    <span className="text-xs text-slate-400">
                      {LANGUAGES[code].label}
                    </span>
                  </span>
                  {lang === code && <Check className="h-4 w-4 text-primary-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
          aria-label={t("topbar.toggleTheme")}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>

        <div className="relative">
          <button
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t("topbar.notifications")}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 rounded-md p-1.5 hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600">
              <span className="text-sm font-medium text-white">
                {user?.firstName?.[0] || "U"}
              </span>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
            />
          </button>

          {open && (
            <div className="absolute end-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
                <p className="mt-1 text-xs text-slate-400">{user?.roleName}</p>
              </div>
              <button
                onClick={() => router.push("/settings/profile")}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <User className="h-4 w-4" />
                {t("topbar.profile")}
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {t("topbar.signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
