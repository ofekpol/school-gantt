"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GanttWeekly } from "@/components/Gantt/GanttWeekly";
import { EventDrawer } from "@/components/Gantt/EventDrawer";
import { ExportToGoogleCalendarButton } from "@/components/ExportToGoogleCalendarButton";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import { QuickEventDialog } from "./QuickEventDialog";
import { buildWeeklyModel, type WeeklyModel } from "@/lib/views/gantt-weekly";
import { buildCalendarModel } from "@/lib/views/calendar";
import type { CalendarMonth } from "@/lib/views/calendar";
import type { CalendarRange } from "@/lib/views/date-range";
import type { EventType } from "@/components/wizard/WizardShell";
import { formatGradeLabel } from "@/lib/grades";
import { shouldShowDashboardGradeFilter } from "@/lib/dashboard/grade-filter";

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
  calendarRange: CalendarRange;
  schoolName: string;
  eventTypes: EventType[];
  allowedGrades: number[];
  selectedGrades: number[];
  canCreateEvents?: boolean;
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
  calendarRange,
  schoolName,
  eventTypes,
  allowedGrades,
  selectedGrades,
  canCreateEvents = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const t = useTranslations("dashboard");
  const [currentView, setCurrentView] = useState(view);
  const [visibleEvents, setVisibleEvents] = useState(events);
  const [selectedGradeState, setSelectedGradeState] = useState(selectedGrades);
  const deferredSelectedGrades = useDeferredValue(selectedGradeState);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const allowedGradeOptions = useMemo(
    () => Array.from(new Set(allowedGrades)).sort((a, b) => a - b),
    [allowedGrades],
  );
  const showGradeFilter = shouldShowDashboardGradeFilter(allowedGradeOptions);
  const displayEvents = useMemo(
    () => visibleEvents.filter((event) => eventMatchesGrades(event, deferredSelectedGrades)),
    [deferredSelectedGrades, visibleEvents],
  );
  const eventMap = useMemo(
    () => new Map(displayEvents.map((event) => [event.id, event])),
    [displayEvents],
  );
  const selectedEvent = selectedEventId ? (eventMap.get(selectedEventId) ?? null) : null;
  const hydratedEvents = useMemo(
    () =>
      displayEvents.map((event) => ({
        ...event,
        startAt: new Date(event.startAt),
        endAt: new Date(event.endAt),
      })),
    [displayEvents],
  );
  const displayWeeklyModel = useMemo(() => {
    if (!weeklyModel || currentView !== "weekly") return undefined;
    return buildWeeklyModel(
      weeklyModel.weekStart,
      hydratedEvents,
      deferredSelectedGrades,
      new Date(),
    );
  }, [currentView, deferredSelectedGrades, hydratedEvents, weeklyModel]);
  const displayMonths = useMemo(() => {
    if (currentView !== "monthly") return months;
    return buildCalendarModel({
      year: calendarRange,
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
  }, [calendarRange, currentView, hydratedEvents, months]);
  const printMonths = useMemo(() =>
    buildCalendarModel({
      year: calendarRange,
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
    }).months,
  [calendarRange, hydratedEvents]);

  useEffect(() => setCurrentView(view), [view]);
  useEffect(() => setVisibleEvents(events), [events]);
  useEffect(() => setSelectedGradeState(selectedGrades), [selectedGrades]);

  function refreshInBackground() {
    startTransition(() => router.refresh());
  }

  function setView(next: "weekly" | "monthly") {
    if (next === currentView) return;
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    startTransition(() => setCurrentView(next));
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  function setGradeFilter(grade: number) {
    const current = new Set(selectedGradeState);
    if (current.has(grade)) current.delete(grade);
    else current.add(grade);
    updateGradeSelection(Array.from(current).sort((a, b) => a - b));
  }

  function selectAllGrades() {
    updateGradeSelection(selectedGradeState.length === allowedGradeOptions.length ? [] : allowedGradeOptions);
  }

  function updateGradeSelection(nextGrades: number[]) {
    const params = new URLSearchParams(window.location.search);
    params.delete("grades");
    if (nextGrades.length === 0) params.set("grades", "none");
    else if (nextGrades.length < allowedGradeOptions.length) {
      for (const grade of nextGrades) params.append("grades", String(grade));
    }
    setSelectedGradeState(nextGrades);
    if (selectedEventId) setSelectedEventId(null);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
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
    const updatedEvent = {
      ...selectedEvent,
      ...patch,
      description: patch.description ?? null,
      location: patch.location ?? null,
      eventTypeKey: selectedType?.key ?? selectedEvent.eventTypeKey,
      eventTypeLabelHe: selectedType?.labelHe ?? selectedEvent.eventTypeLabelHe,
      eventTypeColor: selectedType?.colorHex ?? selectedEvent.eventTypeColor,
      eventTypeGlyph: selectedType?.glyph ?? selectedEvent.eventTypeGlyph,
      status: "approved" as const,
      isCanceled: false,
      isUpdated: true,
    };
    setVisibleEvents((current) =>
      eventMatchesGrades(updatedEvent, selectedGradeState)
        ? current.map((event) => (event.id === selectedEvent.id ? updatedEvent : event))
        : current.filter((event) => event.id !== selectedEvent.id),
    );
    if (!eventMatchesGrades(updatedEvent, selectedGradeState)) setSelectedEventId(null);
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

  async function dismissSelectedCanceledEvent(): Promise<boolean> {
    if (!selectedEvent?.isCanceled) return false;
    const res = await fetch(`/api/v1/events/${selectedEvent.id}`, { method: "DELETE" });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (body?.status !== "dismissed") return false;
    setSelectedEventId(null);
    setVisibleEvents((current) => current.filter((event) => event.id !== selectedEvent.id));
    return true;
  }

  function addPublishedEvent(event: SerializedEvent) {
    if (!eventMatchesGrades(event, selectedGradeState)) {
      refreshInBackground();
      return;
    }
    setVisibleEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
    refreshInBackground();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-6 pt-4">
        <div className="flex items-center gap-2">
          <ToggleBtn active={currentView === "weekly"} onClick={() => setView("weekly")}>
            {t("viewWeekly")}
          </ToggleBtn>
          <ToggleBtn active={currentView === "monthly"} onClick={() => setView("monthly")}>
            {t("viewMonthly")}
          </ToggleBtn>
        </div>
        <ExportToGoogleCalendarButton
          labelKey="shortButton"
          printCalendar={{ months: printMonths, schoolName, yearLabel: calendarRange.label }}
          buttonClassName="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--sg-hairline)] bg-[var(--sg-surface)] px-3.5 text-[13px] font-medium text-[var(--sg-ink-mute)] transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
      </div>

      {showGradeFilter && (
        <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
          <span className="text-sm font-medium text-neutral-600">{t("gradeFilterLabel")}</span>
          <button
            type="button"
            onClick={selectAllGrades}
            className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            {t(selectedGradeState.length === allowedGradeOptions.length ? "clearAllGrades" : "selectAllGrades")}
          </button>
          <div className="flex gap-1.5 overflow-x-auto overflow-y-hidden">
            {allowedGradeOptions.map((grade) => {
              const active = selectedGradeState.includes(grade);
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setGradeFilter(grade)}
                  aria-pressed={active}
                  aria-label={t("gradeFilterOption", { grade: formatGradeLabel(grade) })}
                  className={`h-8 min-w-11 rounded-md border px-3 text-sm font-semibold transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {formatGradeLabel(grade)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canCreateEvents && (
        <div className={`flex justify-start px-6 ${showGradeFilter ? "pt-3" : "pt-4"}`}>
          <button
            type="button"
            onClick={() => openNewEvent(new Date().toISOString().slice(0, 10))}
            className="sg-button-primary rounded-md px-4 py-2 text-sm"
          >
            {t("newEvent")}
          </button>
        </div>
      )}

      {currentView === "weekly" && displayWeeklyModel && (
        <GanttWeekly
          model={displayWeeklyModel}
          events={displayEvents}
          onDayClick={canCreateEvents ? openNewEvent : undefined}
          onEventClick={setSelectedEventId}
          navigationMode="local"
        />
      )}
      {currentView === "monthly" && displayMonths && (
        <YearCalendarGrid
          months={displayMonths}
          yearLabel={calendarRange.label}
          schoolName={schoolName}
          onDayClick={canCreateEvents ? openNewEvent : undefined}
          onEventClick={setSelectedEventId}
        />
      )}

      {canCreateEvents && (
        <QuickEventDialog
          open={pendingDate !== null}
          dateIso={pendingDate}
          eventTypes={eventTypes}
          allowedGrades={allowedGradeOptions}
          onClose={() => setPendingDate(null)}
          onPublished={addPublishedEvent}
        />
      )}
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
        allowedGrades={allowedGradeOptions}
        onSave={saveSelectedEvent}
        onDelete={deleteSelectedEvent}
        onDismiss={dismissSelectedCanceledEvent}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
}

function eventMatchesGrades(
  event: Pick<SerializedEvent, "grades" | "eventTypeKey">,
  selectedGrades: number[],
) {
  return (
    event.eventTypeKey === "holiday" ||
    event.grades.some((grade) => selectedGrades.includes(grade))
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
        active ? "bg-[var(--sg-studio-violet)] text-white shadow-sm" : "bg-[var(--sg-studio-violet-soft)] text-[var(--sg-ink)] hover:bg-violet-100"
      }`}
    >
      {children}
    </button>
  );
}
