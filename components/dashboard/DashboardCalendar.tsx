"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GanttWeekly } from "@/components/Gantt/GanttWeekly";
import { EventDrawer } from "@/components/Gantt/EventDrawer";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import { QuickEventDialog } from "./QuickEventDialog";
import { buildWeeklyModel, type WeeklyModel } from "@/lib/views/gantt-weekly";
import { buildCalendarModel } from "@/lib/views/calendar";
import type { CalendarMonth } from "@/lib/views/calendar";
import type { EventType } from "@/components/wizard/WizardShell";

interface SerializedEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  description: string | null;
  location: string | null;
  eventTypeId: string;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  grades: number[];
  status: "approved" | "canceled";
  isCanceled: boolean;
  isUpdated: boolean;
  canEdit: boolean;
}

interface Props {
  view: "weekly" | "monthly";
  weeklyModel?: WeeklyModel;
  months?: CalendarMonth[];
  events: SerializedEvent[];
  yearLabel: string;
  schoolName: string;
  yearBounds: { startDate: string; endDate: string } | null;
  eventTypes: EventType[];
  allowedGrades: number[];
}

/**
 * Dashboard calendar wrapper — segmented toggle (weekly/monthly) + day-clicks
 * open a compact event dialog with `date` pre-filled.
 * Toggle state is URL-driven via `?view=`.
 */
export function DashboardCalendar({
  view,
  weeklyModel,
  months,
  events,
  yearLabel,
  schoolName,
  yearBounds,
  eventTypes,
  allowedGrades,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const t = useTranslations("dashboard");
  const [currentView, setCurrentView] = useState(view);
  const [visibleEvents, setVisibleEvents] = useState(events);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = visibleEvents.find((event) => event.id === selectedEventId) ?? null;
  const hydratedEvents = useMemo(
    () =>
      visibleEvents.map((event) => ({
        ...event,
        startAt: new Date(event.startAt),
        endAt: new Date(event.endAt),
      })),
    [visibleEvents],
  );
  const displayWeeklyModel = useMemo(() => {
    if (!weeklyModel) return undefined;
    return buildWeeklyModel(
      weeklyModel.weekStart,
      hydratedEvents,
      weeklyModel.rows.map((row) => row.grade),
      new Date(),
    );
  }, [hydratedEvents, weeklyModel]);
  const displayMonths = useMemo(() => {
    if (!yearBounds) return months;
    return buildCalendarModel({
      year: yearBounds,
      events: hydratedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        grades: event.grades,
        eventTypeKey: event.eventTypeKey,
        eventTypeLabelHe: event.eventTypeLabelHe,
        eventTypeColor: event.eventTypeColor,
        eventTypeGlyph: event.eventTypeGlyph,
        status: event.status,
        isCanceled: event.isCanceled,
        isUpdated: event.isUpdated,
      })),
    }).months;
  }, [hydratedEvents, months, yearBounds]);

  useEffect(() => setCurrentView(view), [view]);
  useEffect(() => setVisibleEvents(events), [events]);

  function refreshInBackground() {
    startTransition(() => router.refresh());
  }

  function setView(next: "weekly" | "monthly") {
    if (next === currentView) return;
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    setCurrentView(next);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  function openNewEvent(dateIso: string) {
    setPendingDate(dateIso);
  }

  async function saveSelectedEvent(patch: {
    title: string;
    description?: string;
    location?: string;
    eventTypeId: string;
    grades: number[];
    startAt: string;
    endAt: string;
    allDay: boolean;
  }): Promise<boolean> {
    if (!selectedEvent?.canEdit) return false;
    const res = await fetch(`/api/v1/events/${selectedEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return false;
    const selectedType = eventTypes.find((type) => type.id === patch.eventTypeId);
    setVisibleEvents((current) =>
      current.map((event) =>
        event.id === selectedEvent.id
          ? {
              ...event,
              ...patch,
              description: patch.description ?? null,
              location: patch.location ?? null,
              eventTypeKey: selectedType?.key ?? event.eventTypeKey,
              eventTypeLabelHe: selectedType?.labelHe ?? event.eventTypeLabelHe,
              eventTypeColor: selectedType?.colorHex ?? event.eventTypeColor,
              eventTypeGlyph: selectedType?.glyph ?? event.eventTypeGlyph,
              status: "approved",
              isCanceled: false,
              isUpdated: true,
            }
          : event,
      ),
    );
    refreshInBackground();
    return true;
  }

  async function deleteSelectedEvent(): Promise<boolean> {
    if (!selectedEvent?.canEdit) return false;
    const res = await fetch(`/api/v1/events/${selectedEvent.id}`, { method: "DELETE" });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (body?.status === "canceled") {
      setVisibleEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? { ...event, status: "canceled", isCanceled: true, canEdit: false }
            : event,
        ),
      );
    } else {
      setSelectedEventId(null);
      setVisibleEvents((current) => current.filter((event) => event.id !== selectedEvent.id));
    }
    refreshInBackground();
    return true;
  }

  function addPublishedEvent(event: SerializedEvent) {
    setVisibleEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
    refreshInBackground();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4">
        <div className="flex items-center gap-2">
          <ToggleBtn active={currentView === "weekly"} onClick={() => setView("weekly")}>
            {t("viewWeekly")}
          </ToggleBtn>
          <ToggleBtn active={currentView === "monthly"} onClick={() => setView("monthly")}>
            {t("viewMonthly")}
          </ToggleBtn>
        </div>
        <button
          type="button"
          onClick={() => openNewEvent(new Date().toISOString().slice(0, 10))}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {t("newEvent")}
        </button>
      </div>

      {currentView === "weekly" && displayWeeklyModel && (
        <GanttWeekly
          model={displayWeeklyModel}
          events={visibleEvents}
          onDayClick={openNewEvent}
          onEventClick={setSelectedEventId}
          navigationMode="local"
        />
      )}
      {currentView === "monthly" && displayMonths && (
        <YearCalendarGrid
          months={displayMonths}
          yearLabel={yearLabel}
          schoolName={schoolName}
          onDayClick={openNewEvent}
          onEventClick={setSelectedEventId}
        />
      )}

      <QuickEventDialog
        open={pendingDate !== null}
        dateIso={pendingDate}
        yearBounds={yearBounds}
        eventTypes={eventTypes}
        allowedGrades={allowedGrades}
        onClose={() => setPendingDate(null)}
        onPublished={addPublishedEvent}
      />
      <EventDrawer
        event={
          selectedEvent
            ? {
                ...selectedEvent,
                startAt: new Date(selectedEvent.startAt),
                endAt: new Date(selectedEvent.endAt),
              }
            : null
        }
        canEdit={selectedEvent?.canEdit ?? false}
        eventTypes={eventTypes}
        allowedGrades={allowedGrades}
        onSave={saveSelectedEvent}
        onDelete={deleteSelectedEvent}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}
