"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

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
}

/**
 * Public filter bar shared across the 4 views (Gantt, calendar, agenda, iCal
 * — phases 5–7 reuse it). Mirrors selection state to the URL so views are
 * shareable. PRD §6.5: default is "all grades, all event types".
 *
 * Tap targets are ≥ 44 px tall on mobile (Lighthouse a11y).
 */
export function FilterBar({
  allGrades,
  eventTypes,
  selectedGrades,
  selectedTypes,
  searchQuery,
}: Props) {
  const t = useTranslations("agenda.filter");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchQuery);
  // Keep local search input in sync if URL changes externally (e.g. back btn).
  useEffect(() => setQ(searchQuery), [searchQuery]);

  function commit(next: URLSearchParams) {
    const queryString = next.toString();
    router.replace(
      (queryString ? `${pathname}?${queryString}` : pathname) as never,
      { scroll: false },
    );
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

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (q.trim().length > 0) next.set("q", q.trim());
    else next.delete("q");
    commit(next);
  }

  function clearAll() {
    setQ("");
    commit(new URLSearchParams());
  }

  const hasAnyFilter =
    selectedGrades.length > 0 || selectedTypes.length > 0 || searchQuery.length > 0;

  return (
    <section
      aria-label={t("ariaLabel")}
      className="bg-white border-b border-neutral-200 px-4 py-3 space-y-3"
    >
      <form onSubmit={handleSearch} role="search" className="flex items-center gap-2">
        <label htmlFor="filter-q" className="sr-only">
          {t("searchLabel")}
        </label>
        <input
          id="filter-q"
          name="q"
          type="search"
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm min-h-11"
          autoComplete="off"
        />
        <Button type="submit" size="sm" className="min-h-11">
          {t("apply")}
        </Button>
        {hasAnyFilter && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearAll}
            className="min-h-11"
          >
            {t("clear")}
          </Button>
        )}
      </form>

      <fieldset aria-label={t("gradesLabel")}>
        <legend className="sr-only">{t("gradesLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {allGrades.map((g) => {
            const active = selectedGrades.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGrade(g)}
                aria-pressed={active}
                className={`min-h-11 min-w-11 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-neutral-300 text-neutral-700"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset aria-label={t("typesLabel")}>
        <legend className="sr-only">{t("typesLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {eventTypes.map((et) => {
            const active = selectedTypes.includes(et.key);
            return (
              <button
                key={et.key}
                type="button"
                onClick={() => toggleType(et.key)}
                aria-pressed={active}
                className={`min-h-11 rounded-full border px-3 py-1 text-sm transition-colors flex items-center gap-2 ${
                  active
                    ? "bg-neutral-900 border-neutral-900 text-white"
                    : "bg-white border-neutral-300 text-neutral-700"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: et.colorHex }}
                />
                {et.labelHe}
              </button>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}

function setMulti(params: URLSearchParams, key: string, values: string[]): void {
  params.delete(key);
  if (values.length === 0) return;
  // Sort for stable URLs (helps caching).
  for (const v of values.slice().sort()) params.append(key, v);
}
