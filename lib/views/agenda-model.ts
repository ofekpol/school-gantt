export interface AgendaItem {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  description: string | null;
  location: string | null;
  eventTypeId?: string;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  grades: number[];
  status?: "approved" | "canceled";
  isCanceled?: boolean;
  isUpdated?: boolean;
}

export interface AgendaWeek {
  /** ISO date (YYYY-MM-DD) of the Sunday that starts this week, Asia/Jerusalem. */
  weekStart: string;
  items: AgendaItem[];
}

export function groupByWeek(items: AgendaItem[]): AgendaWeek[] {
  const byKey = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const key = jerusalemWeekStartKey(item.startAt);
    const list = byKey.get(key) ?? [];
    list.push(item);
    byKey.set(key, list);
  }
  const keys = Array.from(byKey.keys()).sort();
  return keys.map((weekStart) => ({
    weekStart,
    items: byKey.get(weekStart)!,
  }));
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function jerusalemWeekStartKey(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const dow = WEEKDAY_INDEX[parts.weekday as keyof typeof WEEKDAY_INDEX] ?? 0;
  const yyyy = Number(parts.year);
  const mm = Number(parts.month);
  const dd = Number(parts.day);
  const anchor = new Date(Date.UTC(yyyy, mm - 1, dd));
  anchor.setUTCDate(anchor.getUTCDate() - dow);
  const y = anchor.getUTCFullYear();
  const m = String(anchor.getUTCMonth() + 1).padStart(2, "0");
  const day = String(anchor.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
