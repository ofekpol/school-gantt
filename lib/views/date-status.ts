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

export type CalendarDateStatusResolver = (date: Date) => CalendarDateStatusDetail;

/** A non-canceled holiday/vacation event reduced to its Jerusalem-local date span. */
interface ClosureInterval {
  first: string;
  last: string;
  isHoliday: boolean;
  isVacation: boolean;
  color: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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
  return createCalendarDateStatusResolver(events)(date);
}

/**
 * Builds a date → status lookup for `events`. Only holiday/vacation events can
 * change a day's status, and each one's Jerusalem date span is computed once
 * here instead of once per (day × event) — which made a multi-year calendar
 * build cost millions of `Intl` calls. Callers that resolve many days against
 * the same events (calendar grid, weekly model) should create one resolver and
 * reuse it. Closure precedence is unchanged: first holiday, then first
 * vacation, in input order; otherwise weekend/normal.
 */
export function createCalendarDateStatusResolver(
  events: CalendarStatusEvent[],
): CalendarDateStatusResolver {
  const closures = collectClosures(events);

  return (date) => {
    const dateKey = jerusalemDateKey(date);
    if (closures.length > 0) {
      const covering = closures.filter(
        (closure) => closure.first <= dateKey && dateKey <= closure.last,
      );
      const holiday = covering.find((closure) => closure.isHoliday);
      if (holiday) return { status: "holiday", closureColor: holiday.color };
      const vacation = covering.find((closure) => closure.isVacation);
      if (vacation) return { status: "vacation", closureColor: vacation.color };
    }
    return { status: isWeekendDateKey(dateKey) ? "weekend" : "normal" };
  };
}

function collectClosures(events: CalendarStatusEvent[]): ClosureInterval[] {
  const closures: ClosureInterval[] = [];
  for (const event of events) {
    if (isCanceled(event)) continue;
    const isHoliday = isClosureType(event, "holiday");
    const isVacation = isClosureType(event, "vacation");
    if (!isHoliday && !isVacation) continue;
    const range = eventJerusalemDateRange(event);
    if (!range) continue;
    closures.push({
      first: range.startDate,
      last: range.endDate,
      isHoliday,
      isVacation,
      color: event.eventTypeColor,
    });
  }
  return closures;
}

/**
 * Jerusalem-local first/last date (YYYY-MM-DD) an event touches, or null for an
 * empty/inverted span. The end is exclusive, so an event ending exactly at local
 * midnight does not touch the next day.
 */
export function eventJerusalemDateRange(
  event: Pick<CalendarStatusEvent, "startAt" | "endAt">,
): { startDate: string; endDate: string } | null {
  if (event.endAt <= event.startAt) return null;
  return {
    startDate: jerusalemDateKey(event.startAt),
    endDate: jerusalemDateKey(new Date(event.endAt.getTime() - 1)),
  };
}

export function eventTouchesJerusalemDate(event: CalendarStatusEvent, dateKey: string): boolean {
  const range = eventJerusalemDateRange(event);
  return range !== null && range.startDate <= dateKey && dateKey <= range.endDate;
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

/** Israeli weekend is Friday/Saturday; `dateKey` is already the Jerusalem-local date. */
function isWeekendDateKey(dateKey: string): boolean {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 5 || weekday === 6;
}
