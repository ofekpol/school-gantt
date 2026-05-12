import { and, eq, isNull } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { events, eventGrades, eventRevisions } from "@/lib/db/schema";

/**
 * Transitions a draft event to `pending` status (WIZARD-06).
 * Writes an event_revisions row capturing the JSONB snapshot (APPROVAL-07).
 *
 * Throws a 404 Response if the event is not found, not a draft,
 * or already soft-deleted.
 */
export async function submitEvent(
  eventId: string,
  schoolId: string,
  submittedBy: string,
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.id, eventId),
          eq(events.schoolId, schoolId),
          eq(events.status, "draft"),
          isNull(events.deletedAt),
        ),
      )
      .limit(1);

    if (!event) throw new Response("Draft event not found", { status: 404 });

    const grades = await tx
      .select({ grade: eventGrades.grade })
      .from(eventGrades)
      .where(eq(eventGrades.eventId, eventId));

    const snapshot = { ...event, grades: grades.map((g) => g.grade) };

    await tx
      .update(events)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(events.id, eventId));

    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot,
      submittedBy,
      decision: "submitted",
    });
  });
}
