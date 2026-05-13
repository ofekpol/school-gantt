/**
 * Printable yearly calendar projection — pure logic, no DB.
 *
 * Renders an 11-month grid (Sept..Jul of the academic year) where each month
 * is a 6×7 grid of day cells (Sunday-start, Israeli convention). Multi-day
 * events are repeated across each day they touch, clipped to the year window.
 *
 * Layout note (PRD §6.4): chips carry both color AND glyph so a black-and-
 * white printout still distinguishes event types — the print stylesheet hides
 * the color fill and reveals the glyph + border style instead.
 */

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
}

export interface CalendarDay {
  /** YYYY-MM-DD (Asia/Jerusalem-local). */
  date: string;
  dayOfMonth: number;
  weekday: number; // 0=Sunday..6=Saturday
  inMonth: boolean;
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

export function buildCalendarModel(input: BuildCalendarInput): CalendarModel {
  const start = parseIsoDate(input.year.startDate);
  const end = parseIsoDate(input.year.endDate);
  const startMs = start.getTime();
  const endMs = end.getTime() + DAY_MS; // exclusive

  // Bucket events per YYYY-MM-DD across all days they touch.
  const eventsByDate = new Map<string, CalendarChip[]>();
  for (const evt of input.events) {
    const evtStart = evt.startAt.getTime();
    const evtEnd = evt.endAt.getTime();
    if (evtEnd <= startMs || evtStart >= endMs) continue;

    const fromDate = atUtcMidnight(Math.max(evtStart, startMs));
    const toDate = atUtcMidnight(Math.min(evtEnd - 1, endMs - 1));
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
      });
      eventsByDate.set(key, list);
      cursor += DAY_MS;
    }
  }

  const months: CalendarMonth[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() < endMs) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth(); // 0-based
    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: (CalendarDay | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const weekday = new Date(Date.UTC(year, month, d)).getUTCDay();
      cells.push({
        date,
        dayOfMonth: d,
        weekday,
        inMonth: true,
        events: eventsByDate.get(date) ?? [],
      });
    }
    // Pad to a multiple of 7
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: CalendarWeek[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push({ days: cells.slice(i, i + 7) });
    }

    months.push({
      year,
      monthIndex: month + 1,
      weeks,
    });

    cursor = new Date(Date.UTC(year, month + 1, 1));
  }

  return { months };
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
