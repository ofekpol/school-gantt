"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ZoomLevel } from "@/lib/views/gantt";

export interface FilterBarEventType {
  key: string;
  labelHe: string;
  colorHex: string;
}

interface Props {
  allGrades: number[];
  eventTypes: FilterBarEventType[];
  selectedGrades: number[];
  selectedTypes: string[];
  searchQuery: string;
  zoom?: ZoomLevel;
}

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
  { value: "term", label: "סמסטר" },
  { value: "year", label: "שנה" },
];

const GRADE_LABELS: Record<number, string> = {
  7: "ז",
  8: "ח",
  9: "ט",
  10: "י",
  11: "יא",
  12: "יב",
};

/**
 * Shared filter bar: grade chips + event-type chips + zoom toggle.
 * Mirrors all state to the URL so views are shareable.
 */
export function FilterBar({
  allGrades,
  eventTypes,
  selectedGrades,
  selectedTypes,
  searchQuery,
  zoom = "week",
}: Props) {
  const t = useTranslations("agenda.filter");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchQuery);
  useEffect(() => setQ(searchQuery), [searchQuery]);

  function commit(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.replace((qs ? `${pathname}?${qs}` : pathname) as never, {
        scroll: false,
      });
    });
  }

  function toggleGrade(g: number) {
    const next = new URLSearchParams(searchParams.toString());
    const current = new Set(selectedGrades);
    if (current.has(g)) current.delete(g);
    else current.add(g);
    setMulti(next, "grades", Array.from(current).map(String));
    commit(next);
  }

  function toggleType(key: string) {
    const next = new URLSearchParams(searchParams.toString());
    const current = new Set(selectedTypes);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    setMulti(next, "types", Array.from(current));
    commit(next);
  }

  function setZoom(z: ZoomLevel) {
    const next = new URLSearchParams(searchParams.toString());
    if (z === "week") next.delete("zoom");
    else next.set("zoom", z);
    commit(next);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (q.trim().length > 0) next.set("q", q.trim());
    else next.delete("q");
    commit(next);
  }

  const hasFilter =
    selectedGrades.length > 0 ||
    selectedTypes.length > 0 ||
    searchQuery.length > 0;

  return (
    <section
      aria-label={t("ariaLabel")}
      className="flex items-center gap-6 px-6 py-3.5 bg-white border-b border-neutral-200 overflow-x-auto"
    >
      {/* Grade chips */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[13px] text-neutral-400 me-1" style={{ fontFamily: "var(--font-display)" }}>
          שכבות
        </span>
        {allGrades.map((g) => {
          const active = selectedGrades.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleGrade(g)}
              aria-pressed={active}
              className="inline-flex items-center justify-center h-[30px] min-w-[44px] px-3 rounded-full border text-[13px] font-semibold transition-colors"
              style={{
                fontFamily: "var(--font-display)",
                background: active ? "var(--ink)" : "white",
                color: active ? "var(--bg)" : "var(--ink-mute)",
                borderColor: active ? "var(--ink)" : "var(--hairline)",
              }}
            >
              {GRADE_LABELS[g] ?? g}
            </button>
          );
        })}
      </div>

      {/* Event-type chips */}
      <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
        <span className="text-[13px] text-neutral-400 me-1 shrink-0" style={{ fontFamily: "var(--font-display)" }}>
          סוגים
        </span>
        <div className="flex gap-1.5 overflow-hidden">
          {eventTypes.slice(0, 8).map((et) => {
            const active = selectedTypes.includes(et.key);
            return (
              <button
                key={et.key}
                type="button"
                onClick={() => toggleType(et.key)}
                aria-pressed={active}
                className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] transition-colors whitespace-nowrap"
                style={{
                  background: active ? "var(--ink)" : "white",
                  color: active ? "var(--bg)" : "var(--ink-mute)",
                  borderColor: active ? "var(--ink)" : "var(--hairline)",
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: et.colorHex }}
                />
                {et.labelHe}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="shrink-0 hidden lg:flex items-center gap-1.5 h-8 px-3 border border-neutral-200 rounded-lg bg-neutral-50 text-[13px] text-neutral-400 min-w-[200px]">
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input
          name="q"
          type="search"
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent outline-none text-neutral-700 text-start"
          autoComplete="off"
        />
      </form>

      {/* Clear */}
      {hasFilter && (
        <button
          type="button"
          onClick={() => { setQ(""); commit(new URLSearchParams()); }}
          className="shrink-0 inline-flex items-center h-8 px-3 rounded-lg border border-neutral-200 text-[13px] text-neutral-500 gap-1.5 hover:text-neutral-900 transition-colors"
        >
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18"/>
          </svg>
          נקה
        </button>
      )}

      {/* Zoom segmented control */}
      <div
        role="radiogroup"
        aria-label="זום"
        className="shrink-0 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 gap-0.5"
      >
        {ZOOM_OPTIONS.map((z) => {
          const active = zoom === z.value;
          return (
            <button
              key={z.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setZoom(z.value)}
              className="h-[26px] px-3.5 rounded-md text-[13px] font-medium transition-colors"
              style={{
                background: active ? "white" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-mute)",
                boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {z.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function setMulti(
  params: URLSearchParams,
  key: string,
  values: string[],
): void {
  params.delete(key);
  if (values.length === 0) return;
  for (const v of values.slice().sort()) params.append(key, v);
}
