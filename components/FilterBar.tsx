"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ZoomLevel } from "@/lib/views/gantt";
import { HEBREW_GRADE_LABELS } from "@/lib/views/gantt-weekly";

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
  zoom: ZoomLevel;
}

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: "week",  label: "שבוע" },
  { value: "month", label: "חודש" },
  { value: "term",  label: "סמסטר" },
  { value: "year",  label: "שנה" },
];

export function FilterBar({
  allGrades,
  eventTypes,
  selectedGrades,
  selectedTypes,
  searchQuery,
  zoom,
}: Props) {
  const t = useTranslations("agenda.filter");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchQuery);
  useEffect(() => setQ(searchQuery), [searchQuery]);

  function commit(next: URLSearchParams) {
    const qs = next.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as never, { scroll: false });
  }

  function toggleGrade(g: number) {
    const next = new URLSearchParams(searchParams.toString());
    const current = new Set(selectedGrades);
    if (current.has(g)) current.delete(g); else current.add(g);
    setMulti(next, "grades", Array.from(current).map(String));
    commit(next);
  }

  function toggleType(key: string) {
    const next = new URLSearchParams(searchParams.toString());
    const current = new Set(selectedTypes);
    if (current.has(key)) current.delete(key); else current.add(key);
    setMulti(next, "types", Array.from(current));
    commit(next);
  }

  function setZoom(next: ZoomLevel) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "year") params.delete("zoom"); else params.set("zoom", next);
    // reset week param when changing zoom
    params.delete("week");
    commit(params);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (q.trim().length > 0) next.set("q", q.trim()); else next.delete("q");
    commit(next);
  }

  return (
    <section
      aria-label={t("ariaLabel")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "14px 24px",
        background: "var(--sg-surface)",
        borderBottom: "1px solid var(--sg-hairline)",
        flexWrap: "wrap",
      }}
    >
      {/* Grade chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={labelStyle}>שכבות</span>
        <div style={{ display: "flex", gap: 6 }}>
          {allGrades.map((g) => {
            const on = selectedGrades.length === 0 || selectedGrades.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGrade(g)}
                aria-pressed={on}
                style={{
                  ...chipBase,
                  fontFamily: "var(--sg-font-display)",
                  fontWeight: 600,
                  minWidth: 44,
                  justifyContent: "center",
                  ...(on ? chipOn : chipOff),
                }}
              >
                {HEBREW_GRADE_LABELS[g] ?? g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event-type chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, overflow: "hidden" }}>
        <span style={labelStyle}>סוגים</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflow: "hidden" }}>
          {eventTypes.slice(0, 9).map((et) => {
            const on = selectedTypes.length === 0 || selectedTypes.includes(et.key);
            return (
              <button
                key={et.key}
                type="button"
                onClick={() => toggleType(et.key)}
                aria-pressed={on}
                style={{ ...chipBase, ...(on ? chipOn : chipOff) }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: et.colorHex, flexShrink: 0,
                }} />
                <span>{et.labelHe}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label htmlFor="filter-q" className="sr-only">{t("searchLabel")}</label>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 32, padding: "0 12px",
          border: "1px solid var(--sg-hairline)",
          borderRadius: 8,
          background: "var(--sg-surface-2)",
          fontSize: 13,
          color: "var(--sg-ink-mute)",
          minWidth: 200,
        }}>
          <SearchIcon />
          <input
            id="filter-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש אירוע…"
            style={{
              flex: 1, border: "none", background: "transparent",
              outline: "none", font: "inherit", color: "inherit",
              textAlign: "start",
            }}
          />
        </div>
      </form>

      {/* Zoom segmented */}
      <div
        role="radiogroup"
        aria-label="זום"
        style={{
          display: "inline-flex",
          background: "var(--sg-surface-2)",
          border: "1px solid var(--sg-hairline)",
          borderRadius: 8,
          padding: 3,
          gap: 2,
          flexShrink: 0,
        }}
      >
        {ZOOM_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={zoom === opt.value}
            onClick={() => setZoom(opt.value)}
            style={{
              appearance: "none",
              border: "none",
              padding: "5px 14px",
              borderRadius: 5,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              background: zoom === opt.value ? "var(--sg-surface)" : "transparent",
              color: zoom === opt.value ? "var(--sg-ink)" : "var(--sg-ink-mute)",
              boxShadow: zoom === opt.value ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              transition: "background 0.1s, color 0.1s",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--sg-font-display)",
  fontSize: 13,
  color: "var(--sg-ink-soft)",
  letterSpacing: "0.01em",
  flexShrink: 0,
};

const chipBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 30,
  padding: "0 11px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "background 0.12s, color 0.12s, border-color 0.12s",
};

const chipOn: React.CSSProperties = {
  background: "var(--sg-ink)",
  color: "var(--sg-bg)",
  border: "1px solid var(--sg-ink)",
};

const chipOff: React.CSSProperties = {
  background: "var(--sg-surface)",
  color: "var(--sg-ink-mute)",
  border: "1px solid var(--sg-hairline)",
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function setMulti(params: URLSearchParams, key: string, values: string[]): void {
  params.delete(key);
  for (const v of values.slice().sort()) params.append(key, v);
}
