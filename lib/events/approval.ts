import "server-only";
import { and, eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventRevisions, events } from "@/lib/db/schema";

/**
 * Transitions a draft event directly to approved status.
 * Any active editor or admin may call this on their own draft.
 * Writes a 'published' revision row for the audit log.
 *
 * Throws Response(404) if not found or not in draft status.
 */
export async function publishEvent(
  schoolId: string,
  eventId: string,
  actorId: string,
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
      decidedBy: actorId,
      decision: "published",
    });
  });
}
