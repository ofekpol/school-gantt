import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventRevisions, events } from "@/lib/db/schema";

/**
 * Transitions a draft event directly to approved, or confirms an already-approved event.
 * Any active editor or admin may call this on their own draft or approved event.
 * Writes a 'published' revision for new publishes, 'edited' for re-publishes.
 *
 * Throws Response(404) if not found or not in a publishable status.
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
      .where(
        and(
          eq(events.id, eventId),
          inArray(events.status, ["draft", "approved"]),
        ),
      )
      .limit(1);

    if (!event) throw new Response("Not found or not publishable", { status: 404 });

    if (event.status === "draft") {
      await tx
        .update(events)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(events.id, eventId));
    }

    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot: event as unknown as Record<string, unknown>,
      decidedBy: actorId,
      decision: event.status === "draft" ? "published" : "edited",
    });
  });
}
