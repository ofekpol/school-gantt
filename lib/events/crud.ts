import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventGrades, events } from "@/lib/db/schema";
import type { EventDraftInput } from "@/lib/validations/events";

/**
 * Creates a new draft event row and returns its id + version.
 * The event row is created with status='draft' and version=1.
 * Must NOT be called inside another withSchool block (RESEARCH Pitfall 5).
 */
export async function createDraft(
  schoolId: string,
  createdBy: string,
  eventTypeId: string,
): Promise<{ id: string; version: number }> {
  const [row] = await withSchool(schoolId, (tx) =>
    tx
      .insert(events)
      .values({
        schoolId,
        createdBy,
        eventTypeId,
        title: "",
        startAt: new Date(),
        endAt: new Date(),
        status: "draft",
        version: 1,
      })
      .returning({ id: events.id, version: events.version }),
  );
  return { id: row.id, version: row.version };
}

export type UpdateDraftResult =
  | { status: "ok"; version: number }
  | { status: "conflict" }
  | { status: "not_found" };

/**
 * Atomically replaces the event_grades rows for an event with the given list.
 * Uses withSchool transaction so RLS is active and the delete+insert pair is atomic.
 * Empty grades array deletes all rows and inserts none.
 */
export async function replaceEventGrades(
  schoolId: string,
  eventId: string,
  grades: number[],
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    await tx.delete(eventGrades).where(eq(eventGrades.eventId, eventId));
    if (grades.length > 0) {
      await tx.insert(eventGrades).values(
        grades.map((grade) => ({ eventId, grade, schoolId })),
      );
    }
  });
}

type EventUpdate = {
  version: number;
  updatedAt: Date;
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: Date;
  endAt?: Date;
  allDay?: boolean;
  eventTypeId?: string;
};

/**
 * Updates allowed draft fields and optionally replaces the event_grades list atomically.
 * Enforces optimistic concurrency via expectedVersion (WIZARD-09).
 * Uses bulk-replace for grades: DELETE then INSERT within the same transaction (RESEARCH Pitfall 6).
 */
export async function updateDraft(
  schoolId: string,
  eventId: string,
  userId: string,
  isAdmin: boolean,
  fields: Partial<EventDraftInput>,
  expectedVersion: number | null,
): Promise<UpdateDraftResult> {
  const { grades, ...eventFields } = fields;

  const result = await withSchool(schoolId, async (tx) => {
    const [current] = await tx
      .select({
        version: events.version,
        createdBy: events.createdBy,
        status: events.status,
      })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!current) return { status: "not_found" as const };
    if (!isAdmin && current.createdBy !== userId) {
      return { status: "not_found" as const };
    }

    // Optimistic concurrency check (WIZARD-09)
    if (expectedVersion !== null && current.version !== expectedVersion) {
      return { status: "conflict" as const };
    }

    const updateSet: EventUpdate = {
      version: current.version + 1,
      updatedAt: new Date(),
    };
    if (eventFields.title !== undefined) updateSet.title = eventFields.title;
    if (eventFields.description !== undefined) updateSet.description = eventFields.description;
    if (eventFields.location !== undefined) updateSet.location = eventFields.location;
    if (eventFields.startAt !== undefined) updateSet.startAt = new Date(eventFields.startAt);
    if (eventFields.endAt !== undefined) updateSet.endAt = new Date(eventFields.endAt);
    if (eventFields.allDay !== undefined) updateSet.allDay = eventFields.allDay;
    if (eventFields.eventTypeId !== undefined) updateSet.eventTypeId = eventFields.eventTypeId;

    const [updated] = await tx
      .update(events)
      .set(updateSet)
      .where(eq(events.id, eventId))
      .returning({ version: events.version });

    return { status: "ok" as const, version: updated.version };
  });

  // Replace grades after the event update transaction completes.
  // replaceEventGrades opens its own withSchool — nesting is not allowed (Pitfall 5).
  if (result.status === "ok" && grades !== undefined) {
    await replaceEventGrades(schoolId, eventId, grades);
  }

  return result;
}

/**
 * Soft-deletes the caller's own draft event (sets deletedAt).
 * Only drafts can be soft-deleted by editors — pending/approved are guarded.
 * Returns {deleted: false} when not found, not owned, or not draft status.
 */
export async function softDelete(
  schoolId: string,
  eventId: string,
  userId: string,
): Promise<{ deleted: boolean }> {
  const result = await withSchool(schoolId, async (tx) => {
    const [row] = await tx
      .select({ id: events.id, createdBy: events.createdBy, status: events.status })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!row) return false;
    if (row.createdBy !== userId) return false;
    if (row.status !== "draft") return false;

    await tx
      .update(events)
      .set({ deletedAt: new Date() })
      .where(eq(events.id, eventId));

    return true;
  });

  return { deleted: result };
}
