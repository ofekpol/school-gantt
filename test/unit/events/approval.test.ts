import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createDraft } from "@/lib/events/crud";
import { publishEvent } from "@/lib/events/approval";
import {
  testDb,
  skipIfNoTestDb,
  shouldSkip,
  testSchoolA,
} from "../../integration/setup";

// publishEvent hits Postgres via withSchool, so these run as integration tests
// and skip cleanly when DATABASE_URL is absent.

async function ensureEditor(email: string): Promise<string> {
  const existing = await testDb!
    .select({ id: schema.staffUsers.id })
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.email, email))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({
      id: randomUUID(),
      schoolId: testSchoolA,
      email,
      fullName: email,
      role: "editor",
      status: "active",
    })
    .returning({ id: schema.staffUsers.id });
  return row.id;
}

async function firstEventType(): Promise<string> {
  const [t] = await testDb!
    .select({ id: schema.eventTypes.id })
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, testSchoolA))
    .limit(1);
  return t.id;
}

describe.skipIf(skipIfNoTestDb)("publishEvent: valid transitions", () => {
  let editorId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorId = await ensureEditor("approval-editor@test");
    eventTypeId = await firstEventType();
  });

  it("draft → approved is a valid transition (writes 'published' revision)", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);

    const [row] = await testDb!
      .select({ status: schema.events.status })
      .from(schema.events)
      .where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");

    const revs = await testDb!
      .select({ decision: schema.eventRevisions.decision })
      .from(schema.eventRevisions)
      .where(eq(schema.eventRevisions.eventId, id));
    expect(revs).toHaveLength(1);
    expect(revs[0].decision).toBe("published");
  });

  it("approved → approved re-publish stays approved and writes an 'edited' revision", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId); // draft → approved ('published')
    await publishEvent(testSchoolA, id, editorId); // approved → approved ('edited')

    const [row] = await testDb!
      .select({ status: schema.events.status })
      .from(schema.events)
      .where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");

    const decisions = (
      await testDb!
        .select({ decision: schema.eventRevisions.decision })
        .from(schema.eventRevisions)
        .where(eq(schema.eventRevisions.eventId, id))
    ).map((r) => r.decision);
    expect(decisions).toContain("published");
    expect(decisions).toContain("edited");
  });
});

describe.skipIf(skipIfNoTestDb)("publishEvent: invalid transitions throw", () => {
  it("publishEvent on a non-existent event throws 404", async () => {
    await expect(
      publishEvent(testSchoolA, randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
  });
});
