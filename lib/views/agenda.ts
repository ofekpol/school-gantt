import "server-only";
import { and, asc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import {
  eventGrades,
  events,
  eventTypes,
} from "@/lib/db/schema";

export interface AgendaItem {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  description: string | null;
  location: string | null;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  grades: number[];
}

export interface AgendaFilters {
  /** Restrict to events touching any of these grades. Empty/undefined = all. */
  grades?: number[];
  /** Restrict to these event-type `key` values. Empty/undefined = all. */
  types?: string[];
  /** Free-text search across title (case-insensitive ILIKE). */
  q?: string;
}

/**
 * Returns approved, non-soft-deleted events for the school, ordered by startAt.
 * Filters are applied at the DB layer to keep cross-school leakage impossible
 * (RLS via withSchool + WHERE clauses), and to keep response size bounded for
 * the public route which has no auth gate.
 *
 * A multi-grade event matches `?grades=10` if any of its grade rows is 10.
 * Cross-grade joining is done with a sub-SELECT to keep the row count = events.
 */
export async function getAgendaForSchool(
  schoolId: string,
  filters: AgendaFilters,
): Promise<AgendaItem[]> {
  return withSchool(schoolId, async (tx) => {
    const conditions = [
      eq(events.status, "approved"),
      isNull(events.deletedAt),
    ];

    if (filters.grades && filters.grades.length > 0) {
      // Drizzle's `sql` tag unwraps a JS array into separate positional params,
      // so `ANY(${gradeList})` becomes `ANY((10))` — Postgres then tries to
      // parse the integer as an array literal and rejects it (22P02). Build
      // `IN (...)` with one positional param per element instead.
      const gradeParams = sql.join(
        filters.grades.map((g) => sql`${g}`),
        sql`, `,
      );
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM event_grades eg
          WHERE eg.event_id = ${events.id}
            AND eg.grade IN (${gradeParams})
        )`,
      );
    }
    if (filters.types && filters.types.length > 0) {
      conditions.push(inArray(eventTypes.key, filters.types));
    }
    if (filters.q && filters.q.trim().length > 0) {
      conditions.push(ilike(events.title, `%${filters.q.trim()}%`));
    }

    const rows = await tx
      .select({
        id: events.id,
        title: events.title,
        startAt: events.startAt,
        endAt: events.endAt,
        allDay: events.allDay,
        description: events.description,
        location: events.location,
        eventTypeKey: eventTypes.key,
        eventTypeLabelHe: eventTypes.labelHe,
        eventTypeColor: eventTypes.colorHex,
        eventTypeGlyph: eventTypes.glyph,
      })
      .from(events)
      .innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id))
      .where(and(...conditions))
      .orderBy(asc(events.startAt), asc(events.id));

    if (rows.length === 0) return [];

    const eventIds = rows.map((r) => r.id);
    const gradeRows = await tx
      .select({ eventId: eventGrades.eventId, grade: eventGrades.grade })
      .from(eventGrades)
      .where(inArray(eventGrades.eventId, eventIds));

    const gradesByEvent = new Map<string, number[]>();
    for (const g of gradeRows) {
      const list = gradesByEvent.get(g.eventId) ?? [];
      list.push(g.grade);
      gradesByEvent.set(g.eventId, list);
    }

    return rows.map((r) => ({
      ...r,
      grades: (gradesByEvent.get(r.id) ?? []).sort((a, b) => a - b),
    }));
  });
}

export interface AgendaWeek {
  /** ISO date (YYYY-MM-DD) of the Sunday that starts this week, Asia/Jerusalem. */
  weekStart: string;
  items: AgendaItem[];
}

/**
 * Groups agenda items by Sunday-start week in Asia/Jerusalem timezone.
 * Israel's school week starts on Sunday, so the agenda mirrors that.
 *
 * Pure function — pulled out of the DB layer so unit tests can exercise it
 * without a Postgres connection.
 */
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

/** YYYY-MM-DD of the Sunday that starts this date's week in Asia/Jerusalem. */
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
  // Anchor in UTC so subtracting days never re-applies a tz offset.
  const anchor = new Date(Date.UTC(yyyy, mm - 1, dd));
  anchor.setUTCDate(anchor.getUTCDate() - dow);
  const y = anchor.getUTCFullYear();
  const m = String(anchor.getUTCMonth() + 1).padStart(2, "0");
  const day = String(anchor.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
