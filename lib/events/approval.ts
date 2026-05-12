import "server-only";
import { and, eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventRevisions, events } from "@/lib/db/schema";

/**
 * Transitions an event from draft → pending.
 * Writes an event_revisions row with decision='submitted' (WIZARD-06).
 * Throws a Response(404) if the event is not found or not in draft status.
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
      .where(and(eq(events.id, eventId), eq(events.status, "draft")))
      .limit(1);

    if (!event) throw new Response("Not found or not a draft", { status: 404 });

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
