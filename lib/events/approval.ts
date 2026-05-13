import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventGrades, eventRevisions, events } from "@/lib/db/schema";

/**
 * Transitions an event into pending.
 * Allowed source states are draft (initial submit) and rejected (editor
 * resubmit after revising) — both write decision='submitted' so the audit
 * log shows the resubmit timestamp.
 *
 * Throws a Response(404) if the event is not found or not in an allowed state.
 *
 * ALL status transitions must go through this file — never set events.status directly
 * in a route handler (CLAUDE.md "Event State Machine").
 */
export async function submitForApproval(
  schoolId: string,
  eventId: string,
  submittedBy: string,
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.id, eventId),
          inArray(events.status, ["draft", "rejected"]),
        ),
      )
      .limit(1);

    if (!event) throw new Response("Not found or not submittable", { status: 404 });

    await tx
      .update(events)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(events.id, eventId));

    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot: event as unknown as Record<string, unknown>,
      submittedBy,
      decision: "submitted",
    });
  });
}

/**
 * Approves a pending event (admin action).
 * Transitions pending → approved.
 *
 * When the event is a revision (parent_event_id set), the parent row is
 * soft-deleted in the same transaction so the public surface only sees
 * the new approved version — satisfying the PRD §6.3 contract:
 * "the previously approved version remains the public version until the
 * new version is approved".
 *
 * Throws Response(404) if not found or not pending.
 */
export async function approveEvent(
  schoolId: string,
  eventId: string,
  decidedBy: string,
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, "pending")))
      .limit(1);

    if (!event) throw new Response("Not found or not pending", { status: 404 });

    await tx
      .update(events)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(events.id, eventId));

    if (event.parentEventId) {
      // Atomic v1 → v2 swap: soft-delete the now-superseded parent.
      await tx
        .update(events)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(events.id, event.parentEventId));
    }

    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot: event as unknown as Record<string, unknown>,
      decidedBy,
      decision: "approved",
    });
  });
}

/**
 * Rejects a pending event (admin action) with a required reason.
 * Transitions pending → rejected.
 * Throws Response(404) if not found or not pending.
 */
export async function rejectEvent(
  schoolId: string,
  eventId: string,
  decidedBy: string,
  reason: string,
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, "pending")))
      .limit(1);

    if (!event) throw new Response("Not found or not pending", { status: 404 });

    await tx
      .update(events)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(events.id, eventId));

    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot: event as unknown as Record<string, unknown>,
      decidedBy,
      decision: "rejected",
      reason,
    });
  });
}

/**
 * Admin-only path: transitions a draft directly to approved without entering
 * pending — PRD §6.3 "Administrator-created events bypass the queue and are
 * auto-approved". One revision is written with decision='approved'.
 *
 * Caller MUST have already verified the actor's admin role at the route layer.
 *
 * Throws Response(404) if not found or not in draft status.
 */
export async function autoApproveAsAdmin(
  schoolId: string,
  eventId: string,
  decidedBy: string,
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, "draft")))
      .limit(1);

    if (!event) throw new Response("Not found or not a draft", { status: 404 });

    await tx
      .update(events)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(events.id, eventId));

    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot: event as unknown as Record<string, unknown>,
      decidedBy,
      decision: "approved",
    });
  });
}

export interface EditApprovedFields {
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: Date;
  endAt?: Date;
  allDay?: boolean;
  eventTypeId?: string;
  grades?: number[];
}

/**
 * Editing an approved event does NOT mutate it — it INSERTs a new row with
 * status='pending' and parent_event_id pointing at the still-public v1.
 * v1 stays visible until the new revision is approved (then approveEvent
 * soft-deletes the parent in the same transaction).
 *
 * Schema-required columns on `events` are non-null (title, start_at,
 * end_at, event_type_id, created_by, school_id) so we copy them all from
 * the parent and overlay the editor's changes.
 *
 * Throws Response(404) if the parent is not approved/visible.
 * Throws Response(409) if a pending revision for this parent already exists.
 */
export async function editApprovedEvent(
  schoolId: string,
  originalEventId: string,
  editorId: string,
  fields: EditApprovedFields,
): Promise<{ id: string }> {
  return withSchool(schoolId, async (tx) => {
    const [original] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.id, originalEventId),
          eq(events.status, "approved"),
          isNull(events.deletedAt),
        ),
      )
      .limit(1);

    if (!original) {
      throw new Response("Not found or not approved", { status: 404 });
    }

    const [existingRevision] = await tx
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.parentEventId, originalEventId),
          eq(events.status, "pending"),
          isNull(events.deletedAt),
        ),
      )
      .limit(1);

    if (existingRevision) {
      throw new Response("Pending revision already exists", { status: 409 });
    }

    const [revision] = await tx
      .insert(events)
      .values({
        schoolId,
        createdBy: editorId,
        parentEventId: originalEventId,
        eventTypeId: fields.eventTypeId ?? original.eventTypeId,
        title: fields.title ?? original.title,
        description: fields.description ?? original.description,
        location: fields.location ?? original.location,
        startAt: fields.startAt ?? original.startAt,
        endAt: fields.endAt ?? original.endAt,
        allDay: fields.allDay ?? original.allDay,
        status: "pending",
        version: original.version + 1,
      })
      .returning({ id: events.id });

    // Copy grades from the source unless the caller overrides them.
    if (fields.grades !== undefined) {
      if (fields.grades.length > 0) {
        await tx.insert(eventGrades).values(
          fields.grades.map((grade) => ({
            eventId: revision.id,
            grade,
            schoolId,
          })),
        );
      }
    } else {
      const parentGrades = await tx
        .select({ grade: eventGrades.grade })
        .from(eventGrades)
        .where(eq(eventGrades.eventId, originalEventId));
      if (parentGrades.length > 0) {
        await tx.insert(eventGrades).values(
          parentGrades.map((g) => ({
            eventId: revision.id,
            grade: g.grade,
            schoolId,
          })),
        );
      }
    }

    await tx.insert(eventRevisions).values({
      eventId: revision.id,
      schoolId,
      snapshot: original as unknown as Record<string, unknown>,
      submittedBy: editorId,
      decision: "submitted",
    });

    return { id: revision.id };
  });
}
