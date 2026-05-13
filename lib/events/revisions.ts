import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import {
  eventGrades,
  eventRevisions,
  events,
  eventTypes,
  staffUsers,
} from "@/lib/db/schema";

export interface QueueRow {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  status: "pending";
  parentEventId: string | null;
  submittedAt: Date;
  submitterId: string;
  submitterName: string;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  grades: number[];
}

/**
 * Returns pending events for the admin queue, sorted oldest-first
 * by the `submitted` revision's createdAt. Includes joined submitter,
 * event type, and grades for compact display.
 *
 * RLS-enforced via withSchool — cross-school pending rows are filtered out
 * by the school_isolation policy.
 */
export async function listPendingForQueue(schoolId: string): Promise<QueueRow[]> {
  return withSchool(schoolId, async (tx) => {
    // Latest `submitted` revision per event = the submission time. Aggregating in
    // SQL keeps the join shape constant even after rejected→pending resubmits.
    const rows = await tx
      .select({
        id: events.id,
        title: events.title,
        startAt: events.startAt,
        endAt: events.endAt,
        parentEventId: events.parentEventId,
        submittedAt: sql<Date>`(
          SELECT MAX(er.created_at) FROM event_revisions er
          WHERE er.event_id = ${events.id} AND er.decision = 'submitted'
        )`.as("submitted_at"),
        submitterId: sql<string>`(
          SELECT er.submitted_by FROM event_revisions er
          WHERE er.event_id = ${events.id} AND er.decision = 'submitted'
          ORDER BY er.created_at DESC LIMIT 1
        )`.as("submitter_id"),
        eventTypeKey: eventTypes.key,
        eventTypeLabelHe: eventTypes.labelHe,
        eventTypeColor: eventTypes.colorHex,
      })
      .from(events)
      .innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id))
      .where(and(eq(events.status, "pending"), isNull(events.deletedAt)))
      .orderBy(asc(sql`submitted_at`));

    if (rows.length === 0) return [];

    const eventIds = rows.map((r) => r.id);
    const submitterIds = Array.from(
      new Set(rows.map((r) => r.submitterId).filter((v): v is string => Boolean(v))),
    );

    const gradesByEvent = new Map<string, number[]>();
    if (eventIds.length > 0) {
      const gradeRows = await tx
        .select({ eventId: eventGrades.eventId, grade: eventGrades.grade })
        .from(eventGrades)
        .where(inArray(eventGrades.eventId, eventIds));
      for (const g of gradeRows) {
        const list = gradesByEvent.get(g.eventId) ?? [];
        list.push(g.grade);
        gradesByEvent.set(g.eventId, list);
      }
    }

    const submitterById = new Map<string, string>();
    if (submitterIds.length > 0) {
      const staff = await tx
        .select({ id: staffUsers.id, fullName: staffUsers.fullName })
        .from(staffUsers)
        .where(inArray(staffUsers.id, submitterIds));
      for (const s of staff) submitterById.set(s.id, s.fullName);
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      startAt: r.startAt,
      endAt: r.endAt,
      status: "pending" as const,
      parentEventId: r.parentEventId,
      submittedAt: r.submittedAt,
      submitterId: r.submitterId,
      submitterName: submitterById.get(r.submitterId) ?? "",
      eventTypeKey: r.eventTypeKey,
      eventTypeLabelHe: r.eventTypeLabelHe,
      eventTypeColor: r.eventTypeColor,
      grades: (gradesByEvent.get(r.id) ?? []).sort((a, b) => a - b),
    }));
  });
}

export interface EventRevisionRow {
  id: string;
  eventId: string;
  decision: string | null;
  reason: string | null;
  submittedBy: string | null;
  decidedBy: string | null;
  createdAt: Date;
}

/**
 * Returns the full revision history for an event, newest-first.
 * Used by the admin queue detail view and the editor's rejected-events page.
 */
export async function getRevisionsForEvent(
  schoolId: string,
  eventId: string,
): Promise<EventRevisionRow[]> {
  return withSchool(schoolId, (tx) =>
    tx
      .select({
        id: eventRevisions.id,
        eventId: eventRevisions.eventId,
        decision: eventRevisions.decision,
        reason: eventRevisions.reason,
        submittedBy: eventRevisions.submittedBy,
        decidedBy: eventRevisions.decidedBy,
        createdAt: eventRevisions.createdAt,
      })
      .from(eventRevisions)
      .where(eq(eventRevisions.eventId, eventId))
      .orderBy(desc(eventRevisions.createdAt)),
  );
}

export interface RejectedEventRow {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  reason: string;
  decidedAt: Date;
  eventTypeId: string;
}

/**
 * Returns the calling editor's rejected events with the latest rejection
 * reason joined from event_revisions. Used by /dashboard/rejected.
 */
export async function getRejectedForEditor(
  schoolId: string,
  staffUserId: string,
): Promise<RejectedEventRow[]> {
  return withSchool(schoolId, (tx) =>
    tx
      .select({
        id: events.id,
        title: events.title,
        startAt: events.startAt,
        endAt: events.endAt,
        eventTypeId: events.eventTypeId,
        reason: sql<string>`(
          SELECT er.reason FROM event_revisions er
          WHERE er.event_id = ${events.id} AND er.decision = 'rejected'
          ORDER BY er.created_at DESC LIMIT 1
        )`.as("reason"),
        decidedAt: sql<Date>`(
          SELECT er.created_at FROM event_revisions er
          WHERE er.event_id = ${events.id} AND er.decision = 'rejected'
          ORDER BY er.created_at DESC LIMIT 1
        )`.as("decided_at"),
      })
      .from(events)
      .where(
        and(
          eq(events.status, "rejected"),
          eq(events.createdBy, staffUserId),
          isNull(events.deletedAt),
        ),
      )
      .orderBy(desc(sql`decided_at`)),
  );
}
