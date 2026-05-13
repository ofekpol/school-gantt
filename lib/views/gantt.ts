/**
 * Gantt projection — pure logic; no DB access here.
 *
 * Layout model:
 *   - x-axis = academic year span (Sept..Jul). 0% = year start, 100% = year end.
 *   - y-axis = one row per grade, in caller-provided order (default 7..12).
 *   - Multi-grade events emit one bar per contiguous run of grades, so e.g.
 *     a single event for grades 9-11 produces one bar with rowSpan=3 (PRD §6.4
 *     C2 decision: render as a single bar spanning the relevant rows).
 *
 * Computing positions on the server lets us SSR the Gantt and meet the
 * "≤ 2 s with 1 k events" target without a client-side layout pass.
 */

export interface GanttInputEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  description: string | null;
  location: string | null;
  grades: number[];
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
}

export interface GanttBar {
  /** Stable id for keying; collisions resolved with run suffix when one event spans non-contiguous grades. */
  id: string;
  /** Original event id (lets a click resolve back to a detail row). */
  eventId: string;
  title: string;
  leftPct: number;
  widthPct: number;
  /** 0-based row index in the caller-provided grades array. */
  rowStart: number;
  /** Number of rows this bar covers. */
  rowSpan: number;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
}

export interface GanttMonth {
  /** ISO date YYYY-MM-DD of the first day of this month (year-local). */
  startDate: string;
  /** 1..12 month number for labelling. */
  monthIndex: number;
  leftPct: number;
  widthPct: number;
}

export interface GanttYearBounds {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive)
}

export interface BuildGanttInput {
  year: GanttYearBounds;
  /** Display order for rows, e.g. [7, 8, 9, 10, 11, 12]. */
  grades: number[];
  events: GanttInputEvent[];
}

export interface GanttModel {
  yearDays: number;
  bars: GanttBar[];
  months: GanttMonth[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildGanttModel(input: BuildGanttInput): GanttModel {
  const startMs = parseIsoDate(input.year.startDate).getTime();
  const endMs = parseIsoDate(input.year.endDate).getTime() + DAY_MS; // exclusive
  const yearMs = endMs - startMs;
  const yearDays = Math.round(yearMs / DAY_MS);

  const gradeRow = new Map<number, number>();
  input.grades.forEach((g, i) => gradeRow.set(g, i));

  const bars: GanttBar[] = [];
  for (const evt of input.events) {
    const evtStart = evt.startAt.getTime();
    const evtEnd = evt.endAt.getTime();
    if (evtEnd <= startMs || evtStart >= endMs) continue;

    const clampedStart = Math.max(evtStart, startMs);
    const clampedEnd = Math.min(evtEnd, endMs);
    const leftPct = ((clampedStart - startMs) / yearMs) * 100;
    let widthPct = ((clampedEnd - clampedStart) / yearMs) * 100;
    // Single-day events still get a visible bar (≥ 1 day's worth of width).
    const minWidth = (DAY_MS / yearMs) * 100;
    if (widthPct < minWidth) widthPct = minWidth;
    if (leftPct + widthPct > 100) widthPct = 100 - leftPct;

    const rowIndices = evt.grades
      .map((g) => gradeRow.get(g))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);

    for (const run of contiguousRuns(rowIndices)) {
      bars.push({
        id: run.length === rowIndices.length ? evt.id : `${evt.id}#${run[0]}`,
        eventId: evt.id,
        title: evt.title,
        leftPct,
        widthPct,
        rowStart: run[0],
        rowSpan: run.length,
        eventTypeKey: evt.eventTypeKey,
        eventTypeLabelHe: evt.eventTypeLabelHe,
        eventTypeColor: evt.eventTypeColor,
        eventTypeGlyph: evt.eventTypeGlyph,
      });
    }
  }

  const months = buildMonths(startMs, endMs, yearMs);
  return { yearDays, bars, months };
}

function contiguousRuns(sorted: number[]): number[][] {
  if (sorted.length === 0) return [];
  const runs: number[][] = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current.push(sorted[i]);
    } else {
      runs.push(current);
      current = [sorted[i]];
    }
  }
  runs.push(current);
  return runs;
}

function buildMonths(startMs: number, endMs: number, yearMs: number): GanttMonth[] {
  const months: GanttMonth[] = [];
  const startDate = new Date(startMs);
  let cursor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
  );
  while (cursor.getTime() < endMs) {
    const nextMonth = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    const segStart = Math.max(cursor.getTime(), startMs);
    const segEnd = Math.min(nextMonth.getTime(), endMs);
    const leftPct = ((segStart - startMs) / yearMs) * 100;
    const widthPct = ((segEnd - segStart) / yearMs) * 100;
    months.push({
      startDate: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-01`,
      monthIndex: cursor.getUTCMonth() + 1,
      leftPct,
      widthPct,
    });
    cursor = nextMonth;
  }
  return months;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export type ZoomLevel = "year" | "term" | "month";

export const ZOOM_LEVELS: ZoomLevel[] = ["year", "term", "month"];

/**
 * Maps a zoom preset to a horizontal scale multiplier applied to the
 * timeline track. `year` fits the full Sept..Jul span in the viewport;
 * deeper zoom widens the track so each month gets more pixels.
 */
export function zoomScale(zoom: ZoomLevel): number {
  switch (zoom) {
    case "year":
      return 1;
    case "term":
      return 3;
    case "month":
      return 11;
  }
}

export function parseZoom(raw: string | undefined): ZoomLevel {
  if (raw === "term" || raw === "month") return raw;
  return "year";
}
