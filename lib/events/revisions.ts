import "server-only";
import { desc, eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventRevisions } from "@/lib/db/schema";

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
