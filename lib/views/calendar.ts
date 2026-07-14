/**
 * Printable yearly calendar projection — pure logic, no DB.
 *
 * Renders the caller-provided display range month by month, where each month
 * is a full-week grid of day cells (Sunday-start, Israeli convention). Leading
 * and trailing cells show adjacent-month dates in a dimmed treatment. Multi-day
 * events are repeated across each visible day they touch.
 *
 * Layout note (PRD §6.4): chips carry both color AND glyph so a black-and-
 * white printout still distinguishes event types — the print stylesheet hides
 * the color fill and reveals the glyph + border style instead.
 */

import {
  getCalendarDateStatusDetail,
  type CalendarDateStatus,
} from "@/lib/views/date-status";

export interface CalendarInputEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  grades: number[];
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  status?: "approved" | "canceled";
  isCanceled?: boolean;
  isUpdated?: boolean;
}

export interface CalendarChip {
  id: string;
  eventId: string;
  title: string;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  grades: number[];
  status?: "approved" | "canceled";
  isCanceled?: boolean;
  isUpdated?: boolean;
}

export interface CalendarDay {
  /** YYYY-MM-DD (Asia/Jerusalem-local). */
  date: string;
  dayOfMonth: number;
  weekday: number; // 0=Sunday..6=Saturday
  inMonth: boolean;
  dateStatus?: CalendarDateStatus;
  closureColor?: string;
  events: CalendarChip[];
}

export interface CalendarWeek {
  days: (CalendarDay | null)[];
}

export interface CalendarMonth {
  year: number;
  /** 1..12, e.g. 9 = September */
  monthIndex: number;
  weeks: CalendarWeek[];
}

export interface BuildCalendarInput {
  year: { startDate: string; endDate: string };
  events: CalendarInputEvent[];
}

export interface CalendarModel {
  months: CalendarMonth[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface VisibleDateRange {
  startMs: number;
  endMs: number;
}

export function buildCalendarModel(input: BuildCalendarInput): CalendarModel {
  const start = parseIsoDate(input.year.startDate);
  const end = parseIsoDate(input.year.endDate);
  const visibleRange = getVisibleDateRange(start, end);
  const eventsByDate = bucketEvents(input.events, visibleRange);
  const months: CalendarMonth[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor <= end) {
    months.push(buildMonth(cursor, input.events, eventsByDate));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return { months };
}

function getVisibleDateRange(start: Date, end: Date): VisibleDateRange {
  const firstMonthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonthEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0));
  const startMs = firstMonthStart.getTime() - firstMonthStart.getUTCDay() * DAY_MS;
  const endMs = lastMonthEnd.getTime() + (7 - lastMonthEnd.getUTCDay()) * DAY_MS;

  return { startMs, endMs };
}

function bucketEvents(
  events: CalendarInputEvent[],
  visibleRange: VisibleDateRange,
): Map<string, CalendarChip[]> {
  const eventsByDate = new Map<string, CalendarChip[]>();

  for (const evt of events) {
    const evtStart = evt.startAt.getTime();
    const evtEnd = evt.endAt.getTime();
    if (evtEnd <= visibleRange.startMs || evtStart >= visibleRange.endMs) continue;

    const fromDate = atUtcMidnight(Math.max(evtStart, visibleRange.startMs));
    const toDate = atUtcMidnight(Math.min(evtEnd - 1, visibleRange.endMs - 1));
    let cursor = fromDate;
    while (cursor <= toDate) {
      const key = isoDate(new Date(cursor));
      const list = eventsByDate.get(key) ?? [];
      list.push({
        id: evt.id,
        eventId: evt.id,
        title: evt.title,
        eventTypeKey: evt.eventTypeKey,
        eventTypeLabelHe: evt.eventTypeLabelHe,
        eventTypeColor: evt.eventTypeColor,
        eventTypeGlyph: evt.eventTypeGlyph,
        grades: evt.grades.slice().sort((a, b) => a - b),
        status: evt.status,
        isCanceled: evt.isCanceled,
        isUpdated: evt.isUpdated,
      });
      eventsByDate.set(key, list);
      cursor += DAY_MS;
    }
  }

  return eventsByDate;
}

function buildMonth(
  monthStart: Date,
  events: CalendarInputEvent[],
  eventsByDate: Map<string, CalendarChip[]>,
): CalendarMonth {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((monthStart.getUTCDay() + daysInMonth) / 7) * 7;
  const gridStart = monthStart.getTime() - monthStart.getUTCDay() * DAY_MS;
  const cells = Array.from({ length: cellCount }, (_, index) =>
    buildDay(new Date(gridStart + index * DAY_MS), month, events, eventsByDate),
  );
  const weeks: CalendarWeek[] = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push({ days: cells.slice(index, index + 7) });
  }

  return { year, monthIndex: month + 1, weeks };
}

function buildDay(
  value: Date,
  month: number,
  events: CalendarInputEvent[],
  eventsByDate: Map<string, CalendarChip[]>,
): CalendarDay {
  const date = isoDate(value);
  const status = getCalendarDateStatusDetail(new Date(`${date}T12:00:00Z`), events);

  return {
    date,
    dayOfMonth: value.getUTCDate(),
    weekday: value.getUTCDay(),
    inMonth: value.getUTCMonth() === month,
    dateStatus: status.status,
    closureColor: status.closureColor,
    events: eventsByDate.get(date) ?? [],
  };
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function atUtcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
