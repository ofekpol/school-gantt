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
  type PublicViewerEvent,
  type PublicViewerParams,
  type PublicViewerView,
} from "@/lib/views/public-viewer";
import type { PublicViewerEventType, PublicViewerYear } from "@/lib/views/public-viewer-data";
import { PublicViewerEventsResponseSchema } from "@/lib/validations/public-viewer";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

interface Props {
  schoolSlug: string;
  schoolName: string;
  initialView: PublicViewerView;
  initialParams: PublicViewerParams;
  year: PublicViewerYear;
  eventTypes: PublicViewerEventType[];
  initialEvents: PublicViewerEvent[];
}

export function PublicViewerShell({
  schoolSlug,
  schoolName,
  initialView,
  initialParams,
  year,
  eventTypes,
  initialEvents,
}: Props) {
  const nav = useTranslations("nav");
  const gantt = useTranslations("gantt");
  const agenda = useTranslations("agenda");
  const [view, setViewState] = useState(initialView);
  const [params, setParamsState] = useState(initialParams);
  const [events, setEvents] = useState(initialEvents);
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
      void refreshEvents(schoolSlug).then((nextEvents) => {
        if (!nextEvents) return;
        startTransition(() => {
          setEvents((current) => (
            publicEventSignature(current) === publicEventSignature(nextEvents)
              ? current
              : nextEvents
          ));
        });
      });
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [schoolSlug, startTransition]);

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
  const response = await fetch(`/api/v1/public/${schoolSlug}/events`, { cache: "no-store" });
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventsResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.events : null;
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

function publicEventSignature(events: PublicViewerEvent[]): string {
  return events.map((event) => `${event.id}:${event.startAt}:${event.endAt}:${event.status}:${event.isUpdated}`).join("|");
}
