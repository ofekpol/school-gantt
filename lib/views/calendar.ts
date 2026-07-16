/**
 * Printable yearly calendar projection — pure logic, no DB.
 *
 * Renders the caller-provided display range month by month, where each month
 * is a full-week grid of day cells (Sunday-start, Israeli convention). Leading
 * and trailing cells show adjacent-month dates in a dimmed treatment. Multi-day
 * events become connected segments while single-day events remain day chips.
 *
 * Layout note (PRD §6.4): chips carry both color AND glyph so a black-and-
 * white printout still distinguishes event types — the print stylesheet hides
 * the color fill and reveals the glyph + border style instead.
 */

import {
  getCalendarDateStatusDetail,
  jerusalemDateKey,
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

export interface CalendarEventSegment extends CalendarChip {
  startColumn: number;
  endColumn: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
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
  segments: CalendarEventSegment[];
  laneCount: number;
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
  startDate: string;
  endDate: string;
}

interface EventDateRange {
  startDate: string;
  endDate: string;
}

interface SegmentCandidate {
  event: CalendarInputEvent;
  startColumn: number;
  endColumn: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
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

  return {
    startDate: isoDate(new Date(startMs)),
    endDate: isoDate(new Date(endMs - 1)),
  };
}

function bucketEvents(
  events: CalendarInputEvent[],
  visibleRange: VisibleDateRange,
): Map<string, CalendarChip[]> {
  const eventsByDate = new Map<string, CalendarChip[]>();

  for (const evt of events) {
    const range = getEventDateRange(evt);
    if (!range || range.startDate !== range.endDate) continue;
    if (range.startDate < visibleRange.startDate || range.startDate > visibleRange.endDate)
      continue;

    const list = eventsByDate.get(range.startDate) ?? [];
    list.push(toCalendarChip(evt));
    eventsByDate.set(range.startDate, list);
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
    weeks.push(buildWeek(cells.slice(index, index + 7), events));
  }

  return { year, monthIndex: month + 1, weeks };
}

function buildWeek(days: CalendarDay[], events: CalendarInputEvent[]): CalendarWeek {
  const weekStart = days[0].date;
  const weekEnd = days[6].date;
  const candidates = events
    .flatMap((event) => toWeekSegmentCandidate(event, weekStart, weekEnd))
    .sort(
      (a, b) =>
        a.startColumn - b.startColumn ||
        a.endColumn - b.endColumn ||
        a.event.id.localeCompare(b.event.id),
    );
  const laneEnds: number[] = [];
  const segments = candidates.map((candidate) => {
    const lane = laneEnds.findIndex((endColumn) => endColumn < candidate.startColumn);
    const assignedLane = lane === -1 ? laneEnds.length : lane;
    laneEnds[assignedLane] = candidate.endColumn;

    return { ...toCalendarChip(candidate.event), ...candidate, lane: assignedLane };
  });

  return { days, segments, laneCount: laneEnds.length };
}

function toWeekSegmentCandidate(
  event: CalendarInputEvent,
  weekStart: string,
  weekEnd: string,
): SegmentCandidate[] {
  const range = getEventDateRange(event);
  if (!range || range.startDate === range.endDate) return [];
  if (range.endDate < weekStart || range.startDate > weekEnd) return [];

  const startDate = maxDate(range.startDate, weekStart);
  const endDate = minDate(range.endDate, weekEnd);
  return [
    {
      event,
      startColumn: dateDistance(weekStart, startDate),
      endColumn: dateDistance(weekStart, endDate),
      continuesBefore: range.startDate < weekStart,
      continuesAfter: range.endDate > weekEnd,
    },
  ];
}

function getEventDateRange(event: CalendarInputEvent): EventDateRange | null {
  if (event.endAt <= event.startAt) return null;
  return {
    startDate: jerusalemDateKey(event.startAt),
    endDate: jerusalemDateKey(new Date(event.endAt.getTime() - 1)),
  };
}

function toCalendarChip(event: CalendarInputEvent): CalendarChip {
  return {
    id: event.id,
    eventId: event.id,
    title: event.title,
    eventTypeKey: event.eventTypeKey,
    eventTypeLabelHe: event.eventTypeLabelHe,
    eventTypeColor: event.eventTypeColor,
    eventTypeGlyph: event.eventTypeGlyph,
    grades: event.grades.slice().sort((a, b) => a - b),
    status: event.status,
    isCanceled: event.isCanceled,
    isUpdated: event.isUpdated,
  };
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

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dateDistance(from: string, to: string): number {
  return (parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS;
}

function maxDate(first: string, second: string): string {
  return first > second ? first : second;
}

function minDate(first: string, second: string): string {
  return first < second ? first : second;
}
