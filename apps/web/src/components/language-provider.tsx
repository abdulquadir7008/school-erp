"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { DEFAULT_LANG, isLang, LANGUAGES, type Lang, type Messages } from "@/lib/i18n";
import { DICTIONARIES, en as enFallback } from "@/lib/i18n/dictionaries";

const OVERRIDE_KEY = "schoolsphere-lang-override";
const SCHOOL_DEFAULT_KEY = "schoolsphere-lang-default";

const MESSAGES: Record<Lang, Messages> = DICTIONARIES;

interface LanguageContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  isRTL: boolean;
  setLang: (lang: Lang) => void;
  applySchoolDefault: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const interpolate = (
  template: string,
  params?: Record<string, string | number>
) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`
  );
};

function applyDocumentDirection(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = LANGUAGES[lang].dir;
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const schoolId = user?.schoolId || "";
  const userId = user?.id || "";
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return DEFAULT_LANG;
    try {
      const override = window.localStorage.getItem(OVERRIDE_KEY);
      if (override && isLang(override)) return override;
    } catch {
      // ignore storage errors (private mode etc.)
    }
    return DEFAULT_LANG;
  });
  const resolvedRef = useRef<string | null>(null);
  const switchedAfterLoginRef = useRef(false);
  const lastUserRef = useRef<string>("");

  // Resolve language:
  // - Logged out (login page): keep manual override so user can preview EN/AR.
  // - Logged in: school default from Settings > General wins on fresh login,
  //   manual topbar switch afterwards is a temporary override.
  useEffect(() => {
    const loginChanged = lastUserRef.current !== userId;
    if (loginChanged) {
      lastUserRef.current = userId;
      switchedAfterLoginRef.current = false;
      resolvedRef.current = null;
    }

    if (!schoolId) {
      // Pre-login: honour stored override, don't call /settings (would 401).
      try {
        const override = localStorage.getItem(OVERRIDE_KEY);
        if (override && isLang(override)) {
          setLangState(override);
        }
      } catch {
        // ignore
      }
      return;
    }

    // If user manually switched after this login, respect it.
    if (switchedAfterLoginRef.current) return;

    const cacheKey = `${SCHOOL_DEFAULT_KEY}-${schoolId}`;
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(cacheKey);
    } catch {
      cached = null;
    }

    // On fresh login (or when default was just saved via applySchoolDefault),
    // the per-school cache holds the school default — apply it immediately
    // so there is no English flash, then revalidate in background.
    if (cached && isLang(cached) && resolvedRef.current !== cacheKey) {
      setLangState(cached);
    }

    if (resolvedRef.current === cacheKey || resolvedRef.current === "pending") {
      return;
    }
    resolvedRef.current = "pending";
    api
      .get("/settings")
      .then((response) => {
        const schoolLang = response.data?.data?.general?.language;
        const next = isLang(schoolLang) ? schoolLang : DEFAULT_LANG;
        try {
          localStorage.setItem(cacheKey, next);
        } catch {
          // ignore
        }
        if (!switchedAfterLoginRef.current) {
          setLangState(next);
        }
        resolvedRef.current = cacheKey;
      })
      .catch(() => {
        resolvedRef.current = cacheKey;
      });
  }, [schoolId, userId]);

  useEffect(() => {
    applyDocumentDirection(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(OVERRIDE_KEY, next);
    } catch {
      // ignore
    }
    switchedAfterLoginRef.current = true;
    setLangState(next);
    applyDocumentDirection(next);
  }, []);

  const applySchoolDefault = useCallback(
    (next: Lang) => {
      try {
        localStorage.removeItem(OVERRIDE_KEY);
      } catch {
        // ignore
      }
      if (schoolId) {
        try {
          localStorage.setItem(`${SCHOOL_DEFAULT_KEY}-${schoolId}`, next);
        } catch {
          // ignore
        }
      }
      switchedAfterLoginRef.current = false;
      resolvedRef.current = schoolId
        ? `${SCHOOL_DEFAULT_KEY}-${schoolId}`
        : "none";
      setLangState(next);
      applyDocumentDirection(next);
    },
    [schoolId]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const messages = MESSAGES[lang] || enFallback;
      const template = messages[key] ?? enFallback[key] ?? key;
      return interpolate(template, params);
    },
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: LANGUAGES[lang].dir,
      isRTL: LANGUAGES[lang].dir === "rtl",
      setLang,
      applySchoolDefault,
      t,
    }),
    [lang, setLang, applySchoolDefault, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return context;
}