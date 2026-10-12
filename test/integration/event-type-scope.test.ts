import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { isEventTypeAllowed } from "@/lib/events/queries";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

/**
 * Event-type scope enforcement (security fix): an editor restricted to some
 * event types must not be allowed to use any other type, while an editor with
 * no event-type scopes keeps access to every type.
 */

async function createEditor(schoolId: string, eventTypeKeys: string[]): Promise<string> {
  const id = randomUUID();
  await testDb!.insert(schema.staffUsers).values({
    id,
    schoolId,
    email: `et-scope-${id}@test`,
    fullName: "Scoped Editor",
    role: "editor",
    status: "active",
  });
  if (eventTypeKeys.length > 0) {
    await testDb!.insert(schema.editorScopes).values(
      eventTypeKeys.map((key) => ({
        staffUserId: id,
        schoolId,
        scopeKind: "event_type" as const,
        scopeValue: key,
      })),
    );
  }
  return id;
}

async function twoEventTypes(schoolId: string) {
  const rows = await testDb!
    .select({ id: schema.eventTypes.id, key: schema.eventTypes.key })
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, schoolId))
    .limit(2);
  if (rows.length < 2) throw new Error("test school needs at least two event types");
  return { allowed: rows[0], other: rows[1] };
}

describe.skipIf(skipIfNoTestDb)("isEventTypeAllowed", () => {
  let types: Awaited<ReturnType<typeof twoEventTypes>>;
  let scopedEditor: string;
  let unscopedEditor: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    types = await twoEventTypes(testSchoolA);
    scopedEditor = await createEditor(testSchoolA, [types.allowed.key]);
    unscopedEditor = await createEditor(testSchoolA, []);
  });

  it("allows a type inside the editor's event-type scope", async () => {
    expect(await isEventTypeAllowed(testSchoolA, scopedEditor, types.allowed.id)).toBe(true);
  });

  it("denies a type outside the editor's event-type scope", async () => {
    expect(await isEventTypeAllowed(testSchoolA, scopedEditor, types.other.id)).toBe(false);
  });

  it("allows every type for an editor with no event-type scopes", async () => {
    expect(await isEventTypeAllowed(testSchoolA, unscopedEditor, types.other.id)).toBe(true);
  });

  it("denies a scoped editor an event type from another school", async () => {
    const [foreign] = await testDb!
      .select({ id: schema.eventTypes.id })
      .from(schema.eventTypes)
      .where(eq(schema.eventTypes.schoolId, testSchoolB))
      .limit(1);
    if (!foreign) return;
    expect(await isEventTypeAllowed(testSchoolA, scopedEditor, foreign.id)).toBe(false);
  });
});
