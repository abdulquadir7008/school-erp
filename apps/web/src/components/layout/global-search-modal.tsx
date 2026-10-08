"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, School, Loader2 } from "lucide-react";
import { useGlobalSearch } from "./global-search";
import { useI18n } from "@/components/language-provider";
import { api } from "@/lib/api";

export function GlobalSearchModal() {
  const { open, closeSearch } = useGlobalSearch();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get("/schools", {
          params: { search: query, limit: 8 },
        });
        setResults(response.data.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [query, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24 backdrop-blur-sm"
      onClick={closeSearch}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <button
            onClick={closeSearch}
            className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-400"
          >
            {t("search.esc")}
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {t("search.noResults", { query })}
            </p>
          )}

          {results.map((school: any) => (
            <button
              key={school.id}
              onClick={() => {
                closeSearch();
                router.push(`/schools/${school.id}`);
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-50"
            >
              <School className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-800">{school.name}</p>
                <p className="text-xs text-slate-500">{school.schoolCode}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}