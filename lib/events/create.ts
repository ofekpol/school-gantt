import { and, eq, sql } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { events, eventGrades } from "@/lib/db/schema";
import type { EventDraftInput } from "@/lib/validations/event";

/**
 * Creates a new draft event row plus its event_grades rows.
 * Uses withSchool so RLS school_isolation policy is active.
 */
export async function createDraftEvent(
  schoolId: string,
  createdBy: string,
  input: EventDraftInput,
): Promise<{ id: string; version: number }> {
  return withSchool(schoolId, async (tx) => {
    const now = new Date();
    const [row] = await tx
      .insert(events)
      .values({
        schoolId,
        createdBy,
        eventTypeId: input.eventTypeId ?? "00000000-0000-0000-0000-000000000000",
        title: input.title ?? "",
        description: input.requirementsText ?? null,
        location: input.responsibleText ?? null,
        startAt: input.startAt ? new Date(input.startAt) : now,
        endAt: input.endAt ? new Date(input.endAt) : now,
        allDay: input.allDay ?? false,
        status: "draft",
        version: 1,
        updatedAt: now,
      })
      .returning({ id: events.id, version: events.version });

    if (input.grades && input.grades.length > 0) {
      await tx.insert(eventGrades).values(
        input.grades.map((grade) => ({ eventId: row.id, grade, schoolId })),
      );
    }

    return { id: row.id, version: row.version };
  });
}

/**
 * Applies a partial update to an existing draft event (autosave per wizard step).
 * Increments version for optimistic concurrency tracking.
 * Returns updated version.
 */
export async function updateEventStep(
  eventId: string,
  schoolId: string,
  input: EventDraftInput,
): Promise<{ version: number }> {
  return withSchool(schoolId, async (tx) => {
    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
      version: sql`${events.version} + 1`,
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.eventTypeId !== undefined) patch.eventTypeId = input.eventTypeId;
    if (input.startAt !== undefined) patch.startAt = new Date(input.startAt);
    if (input.endAt !== undefined) patch.endAt = new Date(input.endAt);
    if (input.allDay !== undefined) patch.allDay = input.allDay;
    if (input.requirementsText !== undefined) patch.description = input.requirementsText;
    if (input.responsibleText !== undefined) patch.location = input.responsibleText;

    const [row] = await tx
      .update(events)
      .set(patch)
      .where(
        and(
          eq(events.id, eventId),
          eq(events.schoolId, schoolId),
        ),
      )
      .returning({ version: events.version });

    if (!row) throw new Response("Event not found", { status: 404 });

    if (input.grades !== undefined) {
      await tx.delete(eventGrades).where(eq(eventGrades.eventId, eventId));
      if (input.grades.length > 0) {
        await tx.insert(eventGrades).values(
          input.grades.map((grade) => ({ eventId, grade, schoolId })),
        );
      }
    }

    return { version: row.version };
  });
}

/**
 * Soft-deletes a draft event (sets deleted_at). Only works on draft status events.
 * WIZARD-08: editors can delete their own drafts.
 */
export async function softDeleteEvent(
  eventId: string,
  schoolId: string,
): Promise<void> {
  await withSchool(schoolId, (tx) =>
    tx
      .update(events)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(events.id, eventId),
          eq(events.schoolId, schoolId),
          eq(events.status, "draft"),
        ),
      ),
  );
}
