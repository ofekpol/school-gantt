"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ExportToGoogleCalendarButton } from "@/components/ExportToGoogleCalendarButton";
import { FilterBar } from "@/components/FilterBar";
import type { CalendarMonth, buildCalendarModel } from "@/lib/views/calendar";
import { parseWeekParam } from "@/lib/views/gantt-weekly";
import {
  filterPublicEvents,
  hydratePublicEvents,
  parsePublicViewerParams,
  serializePublicViewerParams,
  shouldRefreshPublicEvents,
  type PublicViewerEvent,
  type PublicViewerParams,
  type PublicViewerView,
} from "@/lib/views/public-viewer";
import type { PublicViewerEventType, PublicViewerYear } from "@/lib/views/public-viewer-data";
import {
  PublicViewerEventSignatureResponseSchema,
  PublicViewerEventsResponseSchema,
} from "@/lib/validations/public-viewer";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

const PublicGanttView = dynamic(() =>
  import("@/components/public/PublicGanttView").then((module) => module.PublicGanttView),
);
const PublicCalendarView = dynamic(() =>
  import("@/components/public/PublicCalendarView").then((module) => module.PublicCalendarView),
);
const PublicAgendaView = dynamic(() =>
  import("@/components/public/PublicAgendaView").then((module) => module.PublicAgendaView),
);

interface Props {
  schoolSlug: string;
  schoolName: string;
  initialView: PublicViewerView;
  initialParams: PublicViewerParams;
  year: PublicViewerYear;
  eventTypes: PublicViewerEventType[];
  initialEvents: PublicViewerEvent[];
  initialEventsSignature: string;
}

export function PublicViewerShell({
  schoolSlug,
  schoolName,
  initialView,
  initialParams,
  year,
  eventTypes,
  initialEvents,
  initialEventsSignature,
}: Props) {
  const nav = useTranslations("nav");
  const gantt = useTranslations("gantt");
  const agenda = useTranslations("agenda");
  const [view, setViewState] = useState(initialView);
  const [params, setParamsState] = useState(initialParams);
  const [events, setEvents] = useState(initialEvents);
  const [eventsSignature, setEventsSignature] = useState(initialEventsSignature);
  const [printMonthKey, setPrintMonthKey] = useState(() =>
    monthKeyForDate(parseWeekParam(initialParams.week ?? undefined)),
  );
  const [, startTransition] = useTransition();
  const deferredView = useDeferredValue(view);
  const deferredParams = useDeferredValue(params);
  const deferredQuery = useDeferredValue(params.q);
  const eventTypesForFilter = useMemo(
    () =>
      eventTypes.map((type) => ({
        key: type.key,
        labelHe: type.labelHe,
        colorHex: type.colorHex,
      })),
    [eventTypes],
  );
  const filteredParams = useMemo(
    () => ({ ...deferredParams, q: deferredQuery }),
    [deferredParams, deferredQuery],
  );
  const filteredEvents = useMemo(
    () => filterPublicEvents(events, filteredParams),
    [events, filteredParams],
  );
  const hydratedEvents = useMemo(() => hydratePublicEvents(filteredEvents), [filteredEvents]);
  const [calendarMonths, setCalendarMonths] = useState<CalendarMonth[] | null>(null);
  const visibleGrades = useMemo(
    () => (params.grades.length > 0 ? params.grades : ALL_GRADES),
    [params.grades],
  );

  useEffect(() => {
    const syncFromLocation = () => {
      setViewState(viewFromPath(window.location.pathname, schoolSlug));
      setParamsState(parsePublicViewerParams(new URLSearchParams(window.location.search)));
    };
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [schoolSlug]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshEventsIfChanged(schoolSlug, eventsSignature).then((result) => {
        if (!result) return;
        startTransition(() => {
          setEventsSignature(result.signature);
          if (result.events) setEvents(result.events);
        });
      });
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [eventsSignature, schoolSlug, startTransition]);

  const updateUrl = useCallback(
    (nextView: PublicViewerView, nextParams: PublicViewerParams, mode: "push" | "replace") => {
      const query = serializePublicViewerParams(nextParams);
      const path = pathForView(schoolSlug, nextView);
      const nextUrl = query ? `${path}?${query}` : path;
      if (mode === "push") window.history.pushState(null, "", nextUrl);
      else window.history.replaceState(null, "", nextUrl);
    },
    [schoolSlug],
  );

  const setView = useCallback(
    (nextView: PublicViewerView) => {
      setViewState(nextView);
      updateUrl(nextView, params, "push");
    },
    [params, updateUrl],
  );

  const setParams = useCallback(
    (nextParams: PublicViewerParams) => {
      setParamsState(nextParams);
      updateUrl(view, nextParams, "replace");
    },
    [updateUrl, view],
  );
  const updatePrintMonth = useCallback((month: { year: number; monthIndex: number }) => {
    setPrintMonthKey(monthKey(month.year, month.monthIndex));
  }, []);
  const loadCalendarMonths = useCallback(async () => {
    const { buildCalendarModel } = await import("@/lib/views/calendar");
    return buildCalendarModel({ year, events: hydratedEvents }).months;
  }, [hydratedEvents, year]);
  const loadPrintCalendar = useCallback(async () => {
    const months = await loadCalendarMonths();
    return {
      months,
      schoolName,
      yearLabel: year.label,
      defaultMonthIndex: monthIndexForKey(months, printMonthKey),
    };
  }, [loadCalendarMonths, printMonthKey, schoolName, year.label]);

  useEffect(() => {
    if (view === "gantt" && params.zoom === "week") {
      setPrintMonthKey(monthKeyForDate(parseWeekParam(params.week ?? undefined)));
    }
  }, [params.week, params.zoom, view]);

  useEffect(() => {
    if (deferredView !== "calendar") return;
    void loadCalendarMonths().then(setCalendarMonths);
  }, [deferredView, loadCalendarMonths]);

  useEffect(() => {
    const loaders = inactiveViewLoaders(view);
    const prefetch = () => loaders.forEach((load) => void load());
    const idleWindow = window as IdleCallbackWindow;
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(prefetch);
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(prefetch, 1);
    return () => window.clearTimeout(id);
  }, [view]);

  return (
    <main className="min-h-screen bg-[var(--sg-page)] pb-12">
      <ViewTabs
        view={view}
        labels={{
          gantt: nav("gantt"),
          calendar: nav("calendar"),
          agenda: nav("agenda"),
        }}
        onChange={setView}
        action={
          <ExportToGoogleCalendarButton
            schoolSlug={schoolSlug}
            allGrades={ALL_GRADES}
            eventTypes={eventTypesForFilter}
            defaultGrades={params.grades}
            defaultTypes={params.types}
            loadPrintCalendar={loadPrintCalendar}
          />
        }
      />
      <FilterBar
        allGrades={ALL_GRADES}
        eventTypes={eventTypesForFilter}
        selectedGrades={params.grades}
        selectedTypes={params.types}
        searchQuery={params.q}
        zoom={params.zoom}
        zoomOptions={zoomOptionsForView(view)}
        onChange={setParams}
      />
      {deferredView === "gantt" && (
        <PublicGanttView
          events={hydratedEvents}
          serializedEvents={filteredEvents}
          year={year}
          params={params}
          grades={visibleGrades}
          emptyLabel={gantt("empty")}
          onWeekChange={(weekStart) => setPrintMonthKey(monthKeyForDate(weekStart))}
        />
      )}
      {deferredView === "calendar" && (
        <PublicCalendarView
          months={calendarMonths ?? []}
          year={year}
          schoolName={schoolName}
          onMonthChange={updatePrintMonth}
        />
      )}
      {deferredView === "agenda" && (
        <PublicAgendaView
          events={hydratedEvents}
          emptyLabel={agenda("empty")}
          mode={params.zoom === "month" ? "month" : "week"}
        />
      )}
    </main>
  );
}

function ViewTabs({
  view,
  labels,
  onChange,
  action,
}: {
  view: PublicViewerView;
  labels: Record<PublicViewerView, string>;
  onChange: (view: PublicViewerView) => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-2 overflow-hidden border-b border-[var(--sg-hairline)] bg-[var(--sg-surface-raised)] px-3 py-2 sm:px-6">
      <div className="inline-flex rounded-lg border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] p-0.5 shadow-sm">
        {(["gantt", "calendar", "agenda"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-pressed={view === item}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === item ? "bg-blue-600 text-white" : "text-neutral-700 hover:bg-white"
            }`}
          >
            {labels[item]}
          </button>
        ))}
      </div>
      {action}
    </div>
  );
}

function inactiveViewLoaders(view: PublicViewerView): Array<() => Promise<unknown>> {
  const loaders = {
    gantt: () => import("@/components/public/PublicGanttView"),
    calendar: () => import("@/components/public/PublicCalendarView"),
    agenda: () => import("@/components/public/PublicAgendaView"),
  };
  return Object.entries(loaders)
    .filter(([name]) => name !== view)
    .map(([, load]) => load);
}

type IdleCallbackWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
};

async function refreshEvents(schoolSlug: string): Promise<PublicViewerEvent[] | null> {
  const response = await fetch(`/api/v1/public/${schoolSlug}/events`);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventsResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.events : null;
}

async function refreshEventsIfChanged(
  schoolSlug: string,
  currentSignature: string,
): Promise<{ signature: string; events: PublicViewerEvent[] | null } | null> {
  const nextSignature = await refreshEventsSignature(schoolSlug);
  if (!nextSignature) return null;
  if (!shouldRefreshPublicEvents(currentSignature, nextSignature)) {
    return { signature: nextSignature, events: null };
  }

  const events = await refreshEvents(schoolSlug);
  return events ? { signature: nextSignature, events } : null;
}

async function refreshEventsSignature(schoolSlug: string): Promise<string | null> {
  const response = await fetch(`/api/v1/public/${schoolSlug}/events/signature`);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventSignatureResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.signature : null;
}

function pathForView(schoolSlug: string, view: PublicViewerView): string {
  if (view === "calendar") return `/${schoolSlug}/calendar`;
  if (view === "agenda") return `/${schoolSlug}/agenda`;
  return `/${schoolSlug}`;
}

function viewFromPath(pathname: string, schoolSlug: string): PublicViewerView {
  if (pathname === `/${schoolSlug}/calendar`) return "calendar";
  if (pathname === `/${schoolSlug}/agenda`) return "agenda";
  return "gantt";
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex).padStart(2, "0")}`;
}

function monthKeyForDate(date: Date): string {
  return monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

function monthIndexForKey(
  months: ReturnType<typeof buildCalendarModel>["months"],
  key: string,
): number {
  const index = months.findIndex((month) => monthKey(month.year, month.monthIndex) === key);
  return index >= 0 ? index : 0;
}

function zoomOptionsForView(view: PublicViewerView) {
  if (view === "calendar") return [];
  if (view === "agenda") return ["week", "month"] as const;
  return undefined;
}
