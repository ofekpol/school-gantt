"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ZoomLevel } from "@/lib/views/gantt";
import { formatGradeLabel } from "@/lib/grades";
import { useRouteProgress } from "@/components/RouteProgress";

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
  zoomOptions?: readonly ZoomLevel[];
  onChange?: (next: {
    grades: number[];
    types: string[];
    q: string;
    zoom: ZoomLevel;
    week: string | null;
  }) => void;
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
  zoomOptions,
  onChange,
}: Props) {
  const t = useTranslations("agenda.filter");
  const router = useRouter();
  const pathname = usePathname();
  const startRouteProgress = useRouteProgress();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchQuery);
  const [localGrades, setLocalGrades] = useState(selectedGrades);
  const [localTypes, setLocalTypes] = useState(selectedTypes);
  const [localZoom, setLocalZoom] = useState(zoom);
  const effectiveGrades = onChange ? localGrades : selectedGrades;
  const effectiveTypes = onChange ? localTypes : selectedTypes;
  const visibleZoomOptions = zoomOptions
    ? ZOOM_OPTIONS.filter((option) => zoomOptions.includes(option.value))
    : ZOOM_OPTIONS;
  const rawZoom = onChange ? localZoom : zoom;
  const effectiveZoom = normalizeZoom(rawZoom, visibleZoomOptions);
  useEffect(() => setQ(searchQuery), [searchQuery]);
  useEffect(() => setLocalGrades(selectedGrades), [selectedGrades]);
  useEffect(() => setLocalTypes(selectedTypes), [selectedTypes]);
  useEffect(() => setLocalZoom(zoom), [zoom]);

  function commit(next: URLSearchParams) {
    if (onChange) {
      const parsed = parseLocalParams(next);
      setLocalGrades(parsed.grades);
      setLocalTypes(parsed.types);
      setLocalZoom(parsed.zoom);
      startTransition(() => onChange(parsed));
      return;
    }
    const qs = next.toString();
    startRouteProgress();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as never, { scroll: false });
  }

  function currentParams() {
    if (onChange) return localParams({
      selectedGrades: effectiveGrades,
      selectedTypes: effectiveTypes,
      searchQuery: q,
      zoom: effectiveZoom,
    });
    return new URLSearchParams(window.location.search);
  }

  function toggleGrade(g: number) {
    const next = currentParams();
    // Empty selection renders as "all on", so toggling starts from the full set.
    const current = new Set(effectiveGrades.length === 0 ? allGrades : effectiveGrades);
    if (current.has(g)) current.delete(g); else current.add(g);
    // Full set === no filter; collapse back to an empty param.
    const values = current.size === allGrades.length ? [] : Array.from(current).map(String);
    setMulti(next, "grades", values);
    commit(next);
  }

  function toggleType(key: string) {
    const next = currentParams();
    const allKeys = eventTypes.map((et) => et.key);
    // Empty selection renders as "all on", so toggling starts from the full set.
    const current = new Set(effectiveTypes.length === 0 ? allKeys : effectiveTypes);
    if (current.has(key)) current.delete(key); else current.add(key);
    const values = current.size === allKeys.length ? [] : Array.from(current);
    setMulti(next, "types", values);
    commit(next);
  }

  function setZoom(next: ZoomLevel) {
    const params = currentParams();
    if (next === "year") params.delete("zoom"); else params.set("zoom", next);
    // reset week param when changing zoom
    params.delete("week");
    commit(params);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = currentParams();
    if (q.trim().length > 0) next.set("q", q.trim()); else next.delete("q");
    commit(next);
  }

  return (
    <section
      aria-label={t("ariaLabel")}
      className="flex flex-wrap items-center gap-3 px-3 py-3 sm:gap-x-6 sm:px-6"
      style={{ background: "var(--sg-surface)", borderBottom: "1px solid var(--sg-hairline)" }}
    >
      {/* Grade chips */}
      <div className="flex items-center gap-2">
        <span style={labelStyle}>שכבות</span>
        <div className="flex gap-1.5 overflow-x-auto overflow-y-hidden">
          {allGrades.map((g) => {
            const on = effectiveGrades.length === 0 || effectiveGrades.includes(g);
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
                {formatGradeLabel(g)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event-type chips — full row on mobile, inline on desktop */}
      <div className="flex basis-full items-center gap-2 overflow-x-auto overflow-y-hidden sm:basis-auto sm:flex-1 sm:min-w-0">
        <span style={{ ...labelStyle, flexShrink: 0 }}>סוגים</span>
        <div className="flex gap-1.5">
          {eventTypes.map((et) => {
            const on = effectiveTypes.length === 0 || effectiveTypes.includes(et.key);
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

      {/* Search + Zoom — share a row on mobile, separate flex items on desktop */}
      <div className="flex basis-full items-center gap-3 sm:contents">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2 sm:flex-none">
          <label htmlFor="filter-q" className="sr-only">{t("searchLabel")}</label>
          <div
            className="flex flex-1 items-center gap-2 sm:flex-none"
            style={{
              height: 32, padding: "0 12px",
              border: "1px solid var(--sg-hairline)",
              borderRadius: 8,
              background: "var(--sg-surface-2)",
              fontSize: 13,
              color: "var(--sg-ink-mute)",
              minWidth: 0,
            }}
          >
            <SearchIcon />
            <input
              id="filter-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש אירוע…"
              className="w-full sm:w-44"
              style={{
                flex: 1, border: "none", background: "transparent",
                outline: "none", font: "inherit", color: "inherit",
                textAlign: "start", minWidth: 0,
              }}
            />
          </div>
          <button type="submit" className="sr-only" tabIndex={-1} />
        </form>

        {visibleZoomOptions.length > 0 && (
          <div
            role="radiogroup"
            aria-label="זום"
            className="flex shrink-0 items-center rounded-lg p-0.5 gap-0.5"
            style={{
              background: "var(--sg-surface-2)",
              border: "1px solid var(--sg-hairline)",
            }}
          >
            {visibleZoomOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={effectiveZoom === opt.value}
                onClick={() => setZoom(opt.value)}
                className="rounded-md px-3 py-1 text-[13px] font-medium cursor-pointer"
                style={{
                  appearance: "none",
                  border: "none",
                  background: effectiveZoom === opt.value ? "var(--sg-surface)" : "transparent",
                  color: effectiveZoom === opt.value ? "var(--sg-ink)" : "var(--sg-ink-mute)",
                  boxShadow: effectiveZoom === opt.value ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "background 0.1s, color 0.1s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function localParams({
  selectedGrades,
  selectedTypes,
  searchQuery,
  zoom,
}: {
  selectedGrades: number[];
  selectedTypes: string[];
  searchQuery: string;
  zoom: ZoomLevel;
}): URLSearchParams {
  const params = new URLSearchParams();
  setMulti(params, "grades", selectedGrades.map(String));
  setMulti(params, "types", selectedTypes);
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  if (zoom !== "year") params.set("zoom", zoom);
  return params;
}

function parseLocalParams(params: URLSearchParams): {
  grades: number[];
  types: string[];
  q: string;
  zoom: ZoomLevel;
  week: string | null;
} {
  const zoomParam = params.get("zoom");
  const nextZoom: ZoomLevel = zoomParam === "week" || zoomParam === "month" || zoomParam === "term" ? zoomParam : "year";
  return {
    grades: parseGradeParams(params.getAll("grades")),
    types: parseTextParams(params.getAll("types")),
    q: (params.get("q") ?? "").trim(),
    zoom: nextZoom,
    week: params.get("week"),
  };
}

function parseGradeParams(values: string[]): number[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 7 && value <= 12)
    .sort((a, b) => a - b);
}

function parseTextParams(values: string[]): string[] {
  return values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean).sort();
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

function normalizeZoom(
  zoom: ZoomLevel,
  options: { value: ZoomLevel; label: string }[],
): ZoomLevel {
  return options.some((option) => option.value === zoom) ? zoom : options[0]?.value ?? zoom;
}
