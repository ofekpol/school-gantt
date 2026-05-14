/**
 * Weekly Gantt projection — pure logic, no DB access.
 *
 * Projects events for a given ISO week (Sunday..Saturday in Asia/Jerusalem)
 * into positioned grid cells for the RTL 7-column day grid.
 * One row per grade; events positioned by time-of-day (07:00–21:00).
 */

const TZ = "Asia/Jerusalem";
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 21;
const HOUR_RANGE = DAY_END_HOUR - DAY_START_HOUR; // 14

const GRADE_LABELS: Record<number, string> = {
  7: "ז",
  8: "ח",
  9: "ט",
  10: "י",
  11: "יא",
  12: "יב",
};

const DAY_NAMES_HE = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];
const DAY_NAMES_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export interface WeeklyGanttInput {
  id: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string;
  allDay: boolean;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  grades: number[];
}

export interface WeeklyCell {
  id: string;
  eventId: string;
  title: string;
  /** % from inline-start of the grade row (0% = Sunday/right in RTL) */
  leftPct: number;
  widthPct: number;
  /** Vertical lane index within the grade row (for overlapping events) */
  lane: number;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  isAllDay: boolean;
  /** Formatted start time, e.g. "08:30". Empty string for all-day events. */
  startHourFmt: string;
}

export interface WeeklyGanttDay {
  idx: number; // 0 = Sunday, 6 = Saturday
  iso: string; // YYYY-MM-DD
  dayNum: number;
  monthNum: number;
  dayNameHe: string;
  dayMonoEn: string;
  isToday: boolean;
  isWeekend: boolean; // Friday (short day) or Saturday
}

export interface WeeklyGanttModel {
  weekStart: string; // YYYY-MM-DD (Sunday)
  weekEnd: string; // YYYY-MM-DD (Saturday)
  days: WeeklyGanttDay[];
  gradeRows: Array<{
    grade: number;
    gradeLabel: string;
    cells: WeeklyCell[];
  }>;
  todayDayIdx: number | null;
}

export function buildWeeklyGanttModel(opts: {
  weekStartISO: string;
  grades: number[];
  events: WeeklyGanttInput[];
  todayISO: string;
}): WeeklyGanttModel {
  const { weekStartISO, grades, events, todayISO } = opts;
  const [sy, sm, sd] = weekStartISO.split("-").map(Number);
  const weekStartUTC = new Date(Date.UTC(sy, sm - 1, sd));

  const days: WeeklyGanttDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartUTC.getTime() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    return {
      idx: i,
      iso,
      dayNum: d.getUTCDate(),
      monthNum: d.getUTCMonth() + 1,
      dayNameHe: DAY_NAMES_HE[i],
      dayMonoEn: DAY_NAMES_EN[i],
      isToday: iso === todayISO,
      isWeekend: i === 5 || i === 6,
    };
  });

  const todayIdx = days.findIndex((d) => d.isToday);

  const gradeRows = grades.map((grade) => {
    const rawCells: Omit<WeeklyCell, "lane">[] = [];

    for (const ev of events) {
      if (!ev.grades.includes(grade)) continue;

      const startAt = new Date(ev.startAt);
      const endAt = new Date(ev.endAt);

      const s = jerusalemOffset(startAt, weekStartUTC);
      const e = jerusalemOffset(endAt, weekStartUTC);

      // Skip events entirely outside this week
      if (s.dayIdx > 6 || e.dayIdx < 0) continue;

      const startDayIdx = Math.max(0, s.dayIdx);
      const endDayIdx = Math.min(6, e.dayIdx);

      let sh: number;
      let eh: number;
      if (ev.allDay) {
        sh = DAY_START_HOUR;
        eh = DAY_END_HOUR;
      } else {
        sh =
          s.dayIdx < 0
            ? DAY_START_HOUR
            : clamp(s.hour + s.minute / 60, DAY_START_HOUR, DAY_END_HOUR);
        eh =
          e.dayIdx > 6
            ? DAY_END_HOUR
            : clamp(e.hour + e.minute / 60, DAY_START_HOUR, DAY_END_HOUR);
      }

      const leftPct = wkPos(startDayIdx, sh);
      const endPct = wkPos(endDayIdx, eh);
      const widthPct = Math.max(endPct - leftPct, 100 / 7 / HOUR_RANGE); // min 1-hr width

      rawCells.push({
        id: `${ev.id}:g${grade}`,
        eventId: ev.id,
        title: ev.title,
        leftPct,
        widthPct,
        eventTypeKey: ev.eventTypeKey,
        eventTypeLabelHe: ev.eventTypeLabelHe,
        eventTypeColor: ev.eventTypeColor,
        eventTypeGlyph: ev.eventTypeGlyph,
        isAllDay: ev.allDay,
        startHourFmt: ev.allDay ? "" : fmtHour(sh),
      });
    }

    return {
      grade,
      gradeLabel: GRADE_LABELS[grade] ?? String(grade),
      cells: assignLanes(rawCells),
    };
  });

  return {
    weekStart: weekStartISO,
    weekEnd: days[6].iso,
    days,
    gradeRows,
    todayDayIdx: todayIdx === -1 ? null : todayIdx,
  };
}

/** Get Jerusalem-local day offset from week start, plus hour/minute. */
function jerusalemOffset(
  date: Date,
  weekStartUTC: Date,
): { dayIdx: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") % 24; // guard against "24" edge case
  const minute = get("minute");
  const localUTC = Date.UTC(year, month - 1, day);
  const dayIdx = Math.round((localUTC - weekStartUTC.getTime()) / 86_400_000);
  return { dayIdx, hour, minute };
}

/** % from inline-start (0 = Sunday right side in RTL, 100 = Saturday left). */
function wkPos(dayIdx: number, hour: number): number {
  const within =
    (clamp(hour, DAY_START_HOUR, DAY_END_HOUR) - DAY_START_HOUR) / HOUR_RANGE;
  return ((dayIdx + within) / 7) * 100;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function assignLanes(
  cells: Omit<WeeklyCell, "lane">[],
): WeeklyCell[] {
  const sorted = [...cells].sort((a, b) => a.leftPct - b.leftPct);
  const laneEnds: number[] = [];
  return sorted.map((cell) => {
    const cellEnd = cell.leftPct + cell.widthPct;
    let lane = laneEnds.findIndex((le) => le <= cell.leftPct + 0.1);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(cellEnd);
    } else {
      laneEnds[lane] = cellEnd;
    }
    return { ...cell, lane };
  });
}

/** Returns today's date as YYYY-MM-DD in Asia/Jerusalem. */
export function getTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/**
 * Given a reference ISO date (YYYY-MM-DD) or today, returns the ISO date of
 * the Sunday of that week.
 */
export function getWeekStartISO(referenceISO?: string): string {
  const base = referenceISO
    ? new Date(`${referenceISO}T00:00:00Z`)
    : new Date(`${getTodayISO()}T00:00:00Z`);
  const dow = base.getUTCDay(); // 0 = Sunday
  const sunday = new Date(base.getTime() - dow * 86_400_000);
  return sunday.toISOString().slice(0, 10);
}

/** Advance a YYYY-MM-DD week start by ±N weeks. */
export function shiftWeek(weekStartISO: string, weeks: number): string {
  const d = new Date(`${weekStartISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
