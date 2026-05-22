"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { GanttWeekly } from "@/components/Gantt/GanttWeekly";
import { EventDrawer } from "@/components/Gantt/EventDrawer";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import { QuickEventDialog } from "./QuickEventDialog";
import type { WeeklyModel } from "@/lib/views/gantt-weekly";
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
  const searchParams = useSearchParams();
  const t = useTranslations("dashboard");
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventOverrides, setEventOverrides] = useState<Record<string, SerializedEvent>>({});
  const selectedEventBase = events.find((event) => event.id === selectedEventId) ?? null;
  const selectedEvent = selectedEventId
    ? (eventOverrides[selectedEventId] ?? selectedEventBase)
    : null;

  function setView(next: "weekly" | "monthly") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
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
    setEventOverrides((current) => ({
      ...current,
      [selectedEvent.id]: {
        ...selectedEvent,
        ...patch,
        description: patch.description ?? null,
        location: patch.location ?? null,
        eventTypeKey: selectedType?.key ?? selectedEvent.eventTypeKey,
        eventTypeLabelHe: selectedType?.labelHe ?? selectedEvent.eventTypeLabelHe,
        eventTypeColor: selectedType?.colorHex ?? selectedEvent.eventTypeColor,
        eventTypeGlyph: selectedType?.glyph ?? selectedEvent.eventTypeGlyph,
        status: "approved",
        isCanceled: false,
        isUpdated: true,
      },
    }));
    router.refresh();
    return true;
  }

  async function deleteSelectedEvent(): Promise<boolean> {
    if (!selectedEvent?.canEdit) return false;
    const res = await fetch(`/api/v1/events/${selectedEvent.id}`, { method: "DELETE" });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (body?.status === "canceled") {
      setEventOverrides((current) => ({
        ...current,
        [selectedEvent.id]: {
          ...selectedEvent,
          status: "canceled",
          isCanceled: true,
          canEdit: false,
        },
      }));
    } else {
      setSelectedEventId(null);
    }
    router.refresh();
    return true;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4">
        <div className="flex items-center gap-2">
          <ToggleBtn active={view === "weekly"} onClick={() => setView("weekly")}>
            {t("viewWeekly")}
          </ToggleBtn>
          <ToggleBtn active={view === "monthly"} onClick={() => setView("monthly")}>
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

      {view === "weekly" && weeklyModel && (
        <GanttWeekly
          model={weeklyModel}
          events={events}
          onDayClick={openNewEvent}
          onEventClick={setSelectedEventId}
        />
      )}
      {view === "monthly" && months && (
        <YearCalendarGrid
          months={months}
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
