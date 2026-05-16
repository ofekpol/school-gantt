/**
 * Weekly Gantt projection — pure logic, no DB access.
 *
 * Timeline: 7 day columns (Sun→Sat) within a single school week.
 * Events are positioned by hour within each day (07:00–21:00 range).
 * Multi-day events span across day columns.
 * RTL layout: Sunday is at inline-start (right), Saturday at inline-end (left).
 */

import type { AgendaItem } from "@/lib/views/agenda";

export const WEEK_DAY_START_HOUR = 7;
export const WEEK_DAY_END_HOUR = 21;
const HOUR_RANGE = WEEK_DAY_END_HOUR - WEEK_DAY_START_HOUR; // 14
const TZ = "Asia/Jerusalem";

export const HEBREW_GRADE_LABELS: Record<number, string> = {
  7: "ז",
  8: "ח",
  9: "ט",
  10: "י",
  11: "יא",
  12: "יב",
};

const HEBREW_DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEBREW_DAY_SHORTS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const MONO_DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export interface WeeklyDay {
  date: Date;
  dayIndex: number;
  hebrewName: string;
  hebrewShort: string;
  monoName: string;
  dayOfMonth: number;
  isToday: boolean;
  isWeekend: boolean;
}

export interface WeeklyEventBar {
  id: string;
  eventId: string;
  title: string;
  eventTypeKey: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  eventTypeLabelHe: string;
  status: "approved" | "pending" | "draft" | "rejected";
  /** 0-based day index within the week (0=Sun, 6=Sat) */
  dayStart: number;
  dayEnd: number;
  /** Position within the full week width (0–100%). RTL: 0=Sunday side. */
  startPct: number;
  widthPct: number;
  /** Stacking lane (0=topmost) for collision avoidance within a grade row. */
  lane: number;
}

export interface WeeklyGradeRow {
  grade: number;
  hebrewLabel: string;
  bars: WeeklyEventBar[];
}

export interface WeeklyModel {
  weekStart: Date;
  weekEnd: Date;
  days: WeeklyDay[];
  rows: WeeklyGradeRow[];
  /** Human-readable week label, e.g. "15–21 בנובמבר" */
  weekLabel: string;
}

/**
 * Returns the Sunday (weekStart) for the week containing `date`
 * in Asia/Jerusalem timezone, expressed as a UTC midnight Date.
 */
export function getWeekStart(date: Date): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const dow: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dow[parts.weekday as string] ?? 0;
  const anchor = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  anchor.setUTCDate(anchor.getUTCDate() - dayOfWeek);
  return anchor;
}

/** Parse a YYYY-MM-DD ISO date into a UTC midnight Date. */
export function parseWeekParam(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return getWeekStart(new Date());
}

function hourInJerusalem(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return Number(parts.hour) + Number(parts.minute) / 60;
}

function dayOfMonthInJerusalem(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, day: "numeric" }).format(date),
  );
}

/** position within full week width (0–100%), 0 = Sunday start */
function wkPos(dayIdx: number, hour: number): number {
  const within = Math.max(0, Math.min(1, (hour - WEEK_DAY_START_HOUR) / HOUR_RANGE));
  return ((dayIdx + within) / 7) * 100;
}

function assignLanes(bars: Omit<WeeklyEventBar, "lane">[]): WeeklyEventBar[] {
  const sorted = [...bars].sort((a, b) => a.startPct - b.startPct);
  const laneEnds: number[] = [];
  return sorted.map((bar) => {
    const end = bar.startPct + bar.widthPct;
    let lane = laneEnds.findIndex((le) => le <= bar.startPct + 0.05);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); }
    else { laneEnds[lane] = end; }
    return { ...bar, lane };
  });
}

export function buildWeeklyModel(
  weekStart: Date,
  events: AgendaItem[],
  grades: number[],
  today: Date,
): WeeklyModel {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayStart = getWeekStart(today);

  const days: WeeklyDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    const isSameWeek = todayStart.getTime() === weekStart.getTime();
    const todayDow =
      (today.getUTCDay() - weekStart.getUTCDay() + 7) % 7;
    return {
      date,
      dayIndex: i,
      hebrewName: HEBREW_DAY_NAMES[i] ?? "",
      hebrewShort: HEBREW_DAY_SHORTS[i] ?? "",
      monoName: MONO_DAY_NAMES[i] ?? "",
      dayOfMonth: dayOfMonthInJerusalem(date),
      isToday: isSameWeek && todayDow === i,
      isWeekend: i >= 5,
    };
  });

  const rows: WeeklyGradeRow[] = grades.map((grade) => {
    const gradeEvents = events.filter(
      (e) => e.grades.includes(grade) && e.endAt > weekStart && e.startAt < weekEnd,
    );

    const bars: Omit<WeeklyEventBar, "lane">[] = gradeEvents.map((e) => {
      const clampedStart = e.startAt < weekStart ? weekStart : e.startAt;
      const clampedEnd = e.endAt > weekEnd ? weekEnd : e.endAt;

      const startDayMs = clampedStart.getTime() - weekStart.getTime();
      const startDayIdx = Math.floor(startDayMs / (24 * 60 * 60 * 1000));
      const endDayMs = clampedEnd.getTime() - weekStart.getTime();
      const endDayIdx = Math.min(6, Math.ceil(endDayMs / (24 * 60 * 60 * 1000)) - 1);

      const startHour = e.allDay ? WEEK_DAY_START_HOUR : hourInJerusalem(clampedStart);
      const endHour = e.allDay ? WEEK_DAY_END_HOUR : hourInJerusalem(clampedEnd);

      const startPct = wkPos(startDayIdx, startHour);
      const endPct = wkPos(Math.max(startDayIdx, endDayIdx), endHour);
      const minWidth = (1 / 7) * 0.3 * 100; // 30% of a day column

      return {
        id: `${e.id}-${grade}`,
        eventId: e.id,
        title: e.title,
        eventTypeKey: e.eventTypeKey,
        eventTypeColor: e.eventTypeColor,
        eventTypeGlyph: e.eventTypeGlyph,
        eventTypeLabelHe: e.eventTypeLabelHe,
        status: "approved" as const,
        dayStart: startDayIdx,
        dayEnd: endDayIdx,
        startPct,
        widthPct: Math.max(endPct - startPct, minWidth),
      };
    });

    return {
      grade,
      hebrewLabel: HEBREW_GRADE_LABELS[grade] ?? String(grade),
      bars: assignLanes(bars),
    };
  });

  const weekLabel = buildWeekLabel(days);
  return { weekStart, weekEnd, days, rows, weekLabel };
}

function buildWeekLabel(days: WeeklyDay[]): string {
  const firstDay = days[0];
  const lastDay = days[6];
  if (!firstDay || !lastDay) return "";
  const monthFmt = new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    month: "long",
  });
  const month = monthFmt.format(firstDay.date);
  return `${firstDay.dayOfMonth}–${lastDay.dayOfMonth} ב${month}`;
}
