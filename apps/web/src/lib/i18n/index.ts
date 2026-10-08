export const DEFAULT_LANG = "en";
export const SUPPORTED_LANGS = ["en", "ar"] as const;

export type Lang = (typeof SUPPORTED_LANGS)[number];

export const LANGUAGES: Record<Lang, { label: string; nativeLabel: string; dir: "ltr" | "rtl" }> = {
  en: { label: "English", nativeLabel: "English", dir: "ltr" },
  ar: { label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
};

export type Messages = Record<string, string>;

export const isLang = (value: string | null | undefined): value is Lang =>
  !!value && (SUPPORTED_LANGS as readonly string[]).includes(value);