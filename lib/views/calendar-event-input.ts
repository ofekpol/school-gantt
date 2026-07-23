import type { CalendarInputEvent } from "@/lib/views/calendar";

type CalendarEventSource = CalendarInputEvent & {
  isCanceled?: boolean;
  isUpdated?: boolean;
};

export function toCalendarInputEvents(events: CalendarEventSource[]): CalendarInputEvent[] {
  return events.map((event) => ({
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
  }));
}
