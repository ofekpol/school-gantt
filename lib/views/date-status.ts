export type CalendarDateStatus = "normal" | "weekend" | "holiday" | "vacation";

export interface CalendarStatusEvent {
  startAt: Date;
  endAt: Date;
  eventTypeKey: string;
  eventTypeColor: string;
  status?: string;
  isCanceled?: boolean;
}

export interface CalendarDateStatusDetail {
  status: CalendarDateStatus;
  closureColor?: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  weekday: "short",
});

export function getCalendarDateStatus(
  date: Date,
  events: CalendarStatusEvent[],
): CalendarDateStatus {
  return getCalendarDateStatusDetail(date, events).status;
}

export function getCalendarDateStatusDetail(
  date: Date,
  events: CalendarStatusEvent[],
): CalendarDateStatusDetail {
  const dateKey = jerusalemDateKey(date);
  const closures = events.filter(
    (event) => !isCanceled(event) && eventTouchesJerusalemDate(event, dateKey),
  );
  const holiday = closures.find((event) => isClosureType(event, "holiday"));
  if (holiday) return { status: "holiday", closureColor: holiday.eventTypeColor };
  const vacation = closures.find((event) => isClosureType(event, "vacation"));
  if (vacation) return { status: "vacation", closureColor: vacation.eventTypeColor };
  return { status: isJerusalemWeekend(date) ? "weekend" : "normal" };
}

export function eventTouchesJerusalemDate(event: CalendarStatusEvent, dateKey: string): boolean {
  if (event.endAt <= event.startAt) return false;
  const first = jerusalemDateKey(event.startAt);
  const last = jerusalemDateKey(new Date(event.endAt.getTime() - 1));
  return first <= dateKey && dateKey <= last;
}

export function jerusalemDateKey(date: Date): string {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isCanceled(event: CalendarStatusEvent): boolean {
  return event.isCanceled === true || event.status === "canceled";
}

function isClosureType(event: CalendarStatusEvent, kind: "holiday" | "vacation"): boolean {
  return event.eventTypeKey.split(/[-_.]/).includes(kind);
}

function isJerusalemWeekend(date: Date): boolean {
  const weekday = weekdayFormatter.format(date);
  return weekday === "Fri" || weekday === "Sat";
}
