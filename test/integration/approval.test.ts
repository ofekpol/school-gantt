import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { publishEvent } from "@/lib/events/approval";
import { getRevisionsForEvent } from "@/lib/events/revisions";
import { createDraft, updateDraft } from "@/lib/events/crud";
import { testDb, skipIfNoTestDb, testSchoolA, testSchoolB } from "./setup";

async function ensureEditor(schoolId: string, email: string, role: "editor" | "admin") {
  const existing = await testDb!
    .select()
    .from(schema.staffUsers)
    .where(and(eq(schema.staffUsers.schoolId, schoolId), eq(schema.staffUsers.email, email)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({ id: randomUUID(), schoolId, email, fullName: email, role })
    .returning();
  return row;
}

async function eventTypeFor(schoolId: string): Promise<string> {
  const [t] = await testDb!
    .select()
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, schoolId))
    .limit(1);
  return t.id;
}

describe.skipIf(skipIfNoTestDb)("PUBLISH-01: publishEvent transitions draft → approved", () => {
  let editorId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    const editor = await ensureEditor(testSchoolA, "publish-editor@test", "editor");
    editorId = editor.id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("changes status to approved and writes a 'published' revision", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");

    const revisions = await getRevisionsForEvent(testSchoolA, id);
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions[0].decision).toBe("published");
    expect(revisions[0].decidedBy).toBe(editorId);
  });

  it("throws 404 when event is not found", async () => {
    await expect(publishEvent(testSchoolA, randomUUID(), editorId)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe.skipIf(skipIfNoTestDb)("PUBLISH-02: publishEvent on already-approved event writes 'edited' revision", () => {
  let editorId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    const editor = await ensureEditor(testSchoolA, "publish-editor@test", "editor");
    editorId = editor.id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("re-publishing an approved event writes 'edited' revision, status stays approved", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);
    await publishEvent(testSchoolA, id, editorId);

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");

    const revisions = await getRevisionsForEvent(testSchoolA, id);
    const decisions = revisions.map((r) => r.decision);
    expect(decisions).toContain("published");
    expect(decisions).toContain("edited");
  });
});

describe.skipIf(skipIfNoTestDb)("PUBLISH-03: updateDraft allows editing approved events", () => {
  let editorId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    const editor = await ensureEditor(testSchoolA, "publish-editor@test", "editor");
    editorId = editor.id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("PATCH on approved event succeeds and writes 'edited' revision", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await updateDraft(testSchoolA, id, editorId, false, { title: "גרסה 1" }, null);
    await publishEvent(testSchoolA, id, editorId);

    const result = await updateDraft(testSchoolA, id, editorId, false, { title: "גרסה 2" }, null);
    expect(result.status).toBe("ok");

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.title).toBe("גרסה 2");
    expect(row.status).toBe("approved");

    const revisions = await getRevisionsForEvent(testSchoolA, id);
    const editedRevision = revisions.find((r) => r.decision === "edited");
    expect(editedRevision).toBeDefined();
  });

  it("cross-school: editor cannot edit another school's event", async () => {
    const editorB = await ensureEditor(testSchoolB, "publish-editor-b@test", "editor");
    const typeB = await eventTypeFor(testSchoolB);
    const { id } = await createDraft(testSchoolB, editorB.id, typeB);
    await publishEvent(testSchoolB, id, editorB.id);

    const result = await updateDraft(testSchoolA, id, editorId, false, { title: "hack" }, null);
    expect(result.status).toBe("not_found");
  });
});
