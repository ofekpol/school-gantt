"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AgendaList } from "@/components/AgendaList";
import { FilterBar } from "@/components/FilterBar";
import { GanttCanvas } from "@/components/Gantt/GanttCanvas";
import { GanttWeekly } from "@/components/Gantt/GanttWeekly";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import { groupByWeek } from "@/lib/views/agenda-model";
import { buildCalendarModel } from "@/lib/views/calendar";
import { buildGanttModel } from "@/lib/views/gantt";
import { buildWeeklyModel, parseWeekParam } from "@/lib/views/gantt-weekly";
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
  const [, startTransition] = useTransition();
  const deferredView = useDeferredValue(view);
  const deferredParams = useDeferredValue(params);
  const deferredQuery = useDeferredValue(params.q);
  const eventTypesForFilter = useMemo(
    () => eventTypes.map((type) => ({
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
  const hydratedEvents = useMemo(
    () => hydratePublicEvents(filteredEvents),
    [filteredEvents],
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

  const updateUrl = useCallback((nextView: PublicViewerView, nextParams: PublicViewerParams, mode: "push" | "replace") => {
    const query = serializePublicViewerParams(nextParams);
    const path = pathForView(schoolSlug, nextView);
    const nextUrl = query ? `${path}?${query}` : path;
    if (mode === "push") window.history.pushState(null, "", nextUrl);
    else window.history.replaceState(null, "", nextUrl);
  }, [schoolSlug]);

  const setView = useCallback((nextView: PublicViewerView) => {
    setViewState(nextView);
    updateUrl(nextView, params, "push");
  }, [params, updateUrl]);

  const setParams = useCallback((nextParams: PublicViewerParams) => {
    setParamsState(nextParams);
    updateUrl(view, nextParams, "replace");
  }, [updateUrl, view]);

  return (
    <main className="min-h-screen bg-neutral-50 pb-12">
      <ViewTabs view={view} labels={{
        gantt: nav("gantt"),
        calendar: nav("calendar"),
        agenda: nav("agenda"),
      }} onChange={setView} />
      <FilterBar
        allGrades={ALL_GRADES}
        eventTypes={eventTypesForFilter}
        selectedGrades={params.grades}
        selectedTypes={params.types}
        searchQuery={params.q}
        zoom={params.zoom}
        onChange={setParams}
      />
      {deferredView === "gantt" && (
        <MemoGantt
          events={hydratedEvents}
          serializedEvents={filteredEvents}
          year={year}
          params={params}
          emptyLabel={gantt("empty")}
        />
      )}
      {deferredView === "calendar" && (
        <MemoCalendar
          events={hydratedEvents}
          year={year}
          schoolName={schoolName}
        />
      )}
      {deferredView === "agenda" && (
        <MemoAgenda events={hydratedEvents} emptyLabel={agenda("empty")} />
      )}
    </main>
  );
}

function ViewTabs({
  view,
  labels,
  onChange,
}: {
  view: PublicViewerView;
  labels: Record<PublicViewerView, string>;
  onChange: (view: PublicViewerView) => void;
}) {
  return (
    <div className="border-b border-neutral-200 bg-white px-3 py-2 sm:px-6">
      <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
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
    </div>
  );
}

const MemoAgenda = memo(function MemoAgenda({
  events,
  emptyLabel,
}: {
  events: ReturnType<typeof hydratePublicEvents>;
  emptyLabel: string;
}) {
  return <AgendaList weeks={groupByWeek(events)} emptyLabel={emptyLabel} />;
});

const MemoCalendar = memo(function MemoCalendar({
  events,
  year,
  schoolName,
}: {
  events: ReturnType<typeof hydratePublicEvents>;
  year: PublicViewerYear;
  schoolName: string;
}) {
  const model = buildCalendarModel({ year, events });
  return <YearCalendarGrid months={model.months} yearLabel={year.label} schoolName={schoolName} />;
});

const MemoGantt = memo(function MemoGantt({
  events,
  serializedEvents,
  year,
  params,
  emptyLabel,
}: {
  events: ReturnType<typeof hydratePublicEvents>;
  serializedEvents: PublicViewerEvent[];
  year: PublicViewerYear;
  params: PublicViewerParams;
  emptyLabel: string;
}) {
  if (params.zoom === "week") {
    const model = buildWeeklyModel(
      parseWeekParam(params.week ?? undefined),
      events,
      ALL_GRADES,
      new Date(),
    );
    return <GanttWeekly model={model} events={serializedEvents} navigationMode="local" />;
  }
  const model = buildGanttModel({ year, grades: ALL_GRADES, events });
  return (
    <GanttCanvas
      events={serializedEvents}
      bars={model.bars}
      months={model.months}
      grades={ALL_GRADES}
      zoom={params.zoom}
      emptyLabel={emptyLabel}
    />
  );
});

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
