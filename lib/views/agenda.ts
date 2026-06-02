import "server-only";
import { and, asc, between, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import {
  eventGrades,
  events,
  eventTypes,
  eventRevisions,
  staffEventDismissals,
} from "@/lib/db/schema";
import type { AgendaItem } from "@/lib/views/agenda-model";
export type { AgendaItem, AgendaWeek } from "@/lib/views/agenda-model";

export interface AgendaFilters {
  /** Restrict to events touching any of these grades. Empty/undefined = all. */
  grades?: number[];
  /** Restrict to these event-type `key` values. Empty/undefined = all. */
  types?: string[];
  /** Free-text search across title (case-insensitive ILIKE). */
  q?: string;
  /** Inclusive date bounds (YYYY-MM-DD). When provided, only events
   *  whose startAt falls within [startDate, endDate] are returned. */
  dateBounds?: { startDate: string; endDate: string };
  /** Hide canceled events this staff user personally dismissed. */
  dismissedByStaffId?: string;
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
      inArray(events.status, ["approved", "canceled"]),
      isNull(events.deletedAt),
    ];

    if (filters.dateBounds) {
      const { startDate, endDate } = filters.dateBounds;
      conditions.push(
        between(events.startAt, new Date(startDate), new Date(`${endDate}T23:59:59Z`)),
      );
    }

    if (filters.grades && filters.grades.length > 0) {
      const gradeList = filters.grades;
      // Drizzle does not serialize a JS number array as a Postgres typed array
      // when embedded in a raw sql template — `ANY($n)` where $n is a plain
      // scalar value is rejected by Postgres. Use IN with individually
      // parameterized values instead; all values are pre-validated integers
      // 7–12 by the caller (parseGradeList) so the list is small and bounded.
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM event_grades eg
          WHERE eg.event_id = ${events.id}
            AND eg.grade IN (${sql.join(gradeList.map((g) => sql`${g}`), sql`, `)})
        )`,
      );
    }
    if (filters.types && filters.types.length > 0) {
      conditions.push(inArray(eventTypes.key, filters.types));
    }
    if (filters.q && filters.q.trim().length > 0) {
      conditions.push(ilike(events.title, `%${filters.q.trim()}%`));
    }
    if (filters.dismissedByStaffId) {
      conditions.push(sql`NOT EXISTS (
        SELECT 1 FROM ${staffEventDismissals}
        WHERE ${staffEventDismissals.eventId} = ${events.id}
          AND ${staffEventDismissals.staffUserId} = ${filters.dismissedByStaffId}
      )`);
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
        eventTypeId: eventTypes.id,
        eventTypeKey: eventTypes.key,
        eventTypeLabelHe: eventTypes.labelHe,
        eventTypeColor: eventTypes.colorHex,
        eventTypeGlyph: eventTypes.glyph,
        status: events.status,
        isUpdated: sql<boolean>`exists (
          select 1 from ${eventRevisions}
          where ${eventRevisions.eventId} = ${events.id}
            and ${eventRevisions.decision} = 'edited'
        )`,
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
      status: r.status === "canceled" ? "canceled" : "approved",
      isCanceled: r.status === "canceled",
      isUpdated: Boolean(r.isUpdated),
    }));
  });
}

export async function getAgendaSignatureForSchool(
  schoolId: string,
  filters: Pick<AgendaFilters, "dateBounds">,
): Promise<string> {
  return withSchool(schoolId, async (tx) => {
    const conditions = [
      inArray(events.status, ["approved", "canceled"]),
      isNull(events.deletedAt),
    ];

    if (filters.dateBounds) {
      const { startDate, endDate } = filters.dateBounds;
      conditions.push(
        between(events.startAt, new Date(startDate), new Date(`${endDate}T23:59:59Z`)),
      );
    }

    const [row] = await tx
      .select({
        count: sql<string>`count(*)::text`,
        versionSum: sql<string>`coalesce(sum(${events.version}), 0)::text`,
        maxUpdatedAt: sql<string | null>`to_char(max(${events.updatedAt}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      })
      .from(events)
      .where(and(...conditions));

    return [
      row?.count ?? "0",
      row?.versionSum ?? "0",
      row?.maxUpdatedAt ?? "none",
    ].join(":");
  });
}

export { groupByWeek } from "@/lib/views/agenda-model";
