"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/AppHeader";
import { FilterBar } from "@/components/FilterBar";
import { PublicGanttView } from "@/components/public/PublicGanttView";
import { PublicCalendarView } from "@/components/public/PublicCalendarView";
import type { CalendarMonth } from "@/lib/views/calendar";
import {
  filterPublicEvents,
  hydratePublicEvents,
  type PublicViewerEvent,
  type PublicViewerParams,
} from "@/lib/views/public-viewer";
import type { PublicViewerEventType, PublicViewerYear } from "@/lib/views/public-viewer-data";
import { usePublicViewerEvents } from "@/lib/views/use-public-viewer-events";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];
const TABS = ["weekly", "monthly"] as const;
type ReadOnlyTab = (typeof TABS)[number];

interface Props {
  schoolSlug: string;
  schoolName: string;
  initialParams: PublicViewerParams;
  year: PublicViewerYear;
  eventTypes: PublicViewerEventType[];
  initialEvents: PublicViewerEvent[];
  initialEventsSignature: string;
}

/**
 * The unauthenticated read-only entry point at /schedule. Deliberately never
 * changes the URL when switching tabs — unlike PublicViewerShell, whose tab
 * switch navigates to /[school]/calendar etc. Reusing that navigation here
 * would let a visitor tab their way out into the full 3-tab public viewer,
 * defeating the "only weekly and monthly" requirement.
 */
export function ReadOnlyViewerShell({
  schoolSlug,
  schoolName,
  initialParams,
  year,
  eventTypes,
  initialEvents,
  initialEventsSignature,
}: Props) {
  const t = useTranslations("schedule");
  const gantt = useTranslations("gantt");
  const [tab, setTab] = useState<ReadOnlyTab>("weekly");
  const [params, setParams] = useState(initialParams);
  const events = usePublicViewerEvents({ schoolSlug, initialEvents, initialEventsSignature });
  const [calendarMonths, setCalendarMonths] = useState<CalendarMonth[] | null>(null);

  const eventTypesForFilter = useMemo(
    () => eventTypes.map((type) => ({ key: type.key, labelHe: type.labelHe, colorHex: type.colorHex })),
    [eventTypes],
  );
  const filteredEvents = useMemo(() => filterPublicEvents(events, params), [events, params]);
  const hydratedEvents = useMemo(() => hydratePublicEvents(filteredEvents), [filteredEvents]);
  const visibleGrades = useMemo(
    () => (params.grades.length > 0 ? params.grades : ALL_GRADES),
    [params.grades],
  );
  const weeklyParams = useMemo(() => ({ ...params, zoom: "week" as const }), [params]);

  useEffect(() => {
    if (tab !== "monthly") return;
    let cancelled = false;
    void import("@/lib/views/calendar").then(({ buildCalendarModel }) => {
      if (cancelled) return;
      setCalendarMonths(buildCalendarModel({ year, events: hydratedEvents }).months);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, year, hydratedEvents]);

  return (
    <>
      <AppHeader title={schoolName} rightSlot={<LoginLink label={t("login")} />} />
      <main className="min-h-screen bg-[var(--sg-page)] pb-12">
        <ReadOnlyViewerTabs
          tab={tab}
          labels={{ weekly: t("weekly"), monthly: t("monthly") }}
          onChange={setTab}
        />
        <FilterBar
          allGrades={ALL_GRADES}
          eventTypes={eventTypesForFilter}
          selectedGrades={params.grades}
          selectedTypes={params.types}
          searchQuery={params.q}
          zoom={params.zoom}
          zoomOptions={[]}
          onChange={setParams}
        />
        {tab === "weekly" && (
          <PublicGanttView
            events={hydratedEvents}
            serializedEvents={filteredEvents}
            year={year}
            params={weeklyParams}
            grades={visibleGrades}
            emptyLabel={gantt("empty")}
            onWeekChange={() => {}}
          />
        )}
        {tab === "monthly" && (
          <PublicCalendarView
            months={calendarMonths ?? []}
            year={year}
            schoolName={schoolName}
            onMonthChange={() => {}}
          />
        )}
      </main>
    </>
  );
}

function LoginLink({ label }: { label: string }) {
  return (
    <Link
      href="/auth/login"
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
    >
      {label}
    </Link>
  );
}

function ReadOnlyViewerTabs({
  tab,
  labels,
  onChange,
}: {
  tab: ReadOnlyTab;
  labels: Record<ReadOnlyTab, string>;
  onChange: (tab: ReadOnlyTab) => void;
}) {
  return (
    <div className="relative flex flex-wrap items-center gap-2 overflow-hidden border-b border-[var(--sg-hairline)] bg-[var(--sg-surface-raised)] px-3 py-2 sm:px-6">
      <div className="inline-flex rounded-lg border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] p-0.5 shadow-sm">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-pressed={tab === item}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === item ? "bg-blue-600 text-white" : "text-neutral-700 hover:bg-white"
            }`}
          >
            {labels[item]}
          </button>
        ))}
      </div>
    </div>
  );
}
