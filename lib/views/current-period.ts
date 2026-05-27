import type { GanttMonth } from "@/lib/views/gantt";

const TZ = "Asia/Jerusalem";
const DAY_MS = 24 * 60 * 60 * 1000;

export function jerusalemDateKey(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function findCurrentMonthStart(months: GanttMonth[], today = new Date()): string | null {
  const todayMonth = jerusalemDateKey(today).slice(0, 7);
  return months.find((month) => month.startDate.startsWith(todayMonth))?.startDate ?? null;
}

export function findCurrentAgendaWeekStart(
  weeks: { weekStart: string }[],
  today = new Date(),
): string | null {
  const todayMs = parseIsoDate(jerusalemDateKey(today)).getTime();
  const current = weeks.find((week) => {
    const startMs = parseIsoDate(week.weekStart).getTime();
    return todayMs >= startMs && todayMs < startMs + 7 * DAY_MS;
  });
  if (current) return current.weekStart;

  const next = weeks.find((week) => parseIsoDate(week.weekStart).getTime() > todayMs);
  return next?.weekStart ?? weeks.at(-1)?.weekStart ?? null;
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
