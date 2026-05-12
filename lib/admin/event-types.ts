import "server-only";
import { eq, asc } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventTypes } from "@/lib/db/schema";
import type { z } from "zod";
import type { EventTypeSchema } from "@/lib/validations/admin";

type EventTypeInput = z.infer<typeof EventTypeSchema>;

export async function createEventType(
  schoolId: string,
  input: EventTypeInput,
): Promise<{ id: string }> {
  const [row] = await withSchool(schoolId, (tx) =>
    tx
      .insert(eventTypes)
      .values({
        schoolId,
        key: input.key,
        labelHe: input.labelHe,
        labelEn: input.labelEn,
        colorHex: input.colorHex,
        glyph: input.glyph,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning({ id: eventTypes.id }),
  );
  return { id: row.id };
}

export async function updateEventType(
  schoolId: string,
  id: string,
  input: Partial<EventTypeInput>,
): Promise<{ updated: boolean }> {
  const rows = await withSchool(schoolId, (tx) =>
    tx
      .update(eventTypes)
      .set({
        ...(input.key !== undefined && { key: input.key }),
        ...(input.labelHe !== undefined && { labelHe: input.labelHe }),
        ...(input.labelEn !== undefined && { labelEn: input.labelEn }),
        ...(input.colorHex !== undefined && { colorHex: input.colorHex }),
        ...(input.glyph !== undefined && { glyph: input.glyph }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      })
      .where(eq(eventTypes.id, id))
      .returning({ id: eventTypes.id }),
  );
  return { updated: rows.length > 0 };
}

export async function deleteEventType(
  schoolId: string,
  id: string,
): Promise<{ deleted: boolean }> {
  const rows = await withSchool(schoolId, (tx) =>
    tx.delete(eventTypes).where(eq(eventTypes.id, id)).returning({ id: eventTypes.id }),
  );
  return { deleted: rows.length > 0 };
}

export async function listEventTypes(schoolId: string) {
  return withSchool(schoolId, (tx) =>
    tx
      .select({
        id: eventTypes.id,
        key: eventTypes.key,
        labelHe: eventTypes.labelHe,
        labelEn: eventTypes.labelEn,
        colorHex: eventTypes.colorHex,
        glyph: eventTypes.glyph,
        sortOrder: eventTypes.sortOrder,
      })
      .from(eventTypes)
      .orderBy(asc(eventTypes.sortOrder)),
  );
}
