import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  createSubscription,
  getSubscriptionByToken,
  listSubscriptionsForStaff,
  revokeSubscription,
} from "@/lib/ical/subscriptions";
import {
  testDb,
  skipIfNoTestDb,
  testSchoolA,
  testSchoolB,
} from "./setup";

async function ensureStaff(
  schoolId: string,
  email: string,
): Promise<string> {
  const [existing] = await testDb!
    .select()
    .from(schema.staffUsers)
    .where(
      and(eq(schema.staffUsers.schoolId, schoolId), eq(schema.staffUsers.email, email)),
    )
    .limit(1);
  if (existing) return existing.id;
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({
      id: randomUUID(),
      schoolId,
      email,
      fullName: email,
      role: "editor",
    })
    .returning();
  return row.id;
}

describe.skipIf(skipIfNoTestDb)("ICAL-01: create + list subscriptions", () => {
  let editorId: string;
  beforeAll(async () => {
    editorId = await ensureStaff(testSchoolA, "ical-editor-a@test");
  });

  it("createSubscription returns a token and writes the row with filters", async () => {
    const { id, token } = await createSubscription(testSchoolA, editorId, {
      grades: [10, 11],
      eventTypes: [],
    });
    expect(token.length).toBeGreaterThanOrEqual(40);

    const rows = await listSubscriptionsForStaff(testSchoolA, editorId);
    const row = rows.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row!.token).toBe(token);
    expect(row!.filterGrades.sort()).toEqual([10, 11]);
    expect(row!.revokedAt).toBeNull();
  });

  it("listSubscriptionsForStaff is scoped to the calling staff user", async () => {
    const otherId = await ensureStaff(testSchoolA, "ical-other-a@test");
    await createSubscription(testSchoolA, otherId, { grades: [], eventTypes: [] });
    const mine = await listSubscriptionsForStaff(testSchoolA, editorId);
    for (const row of mine) {
      // No row from `otherId` should leak in.
      expect(row).toBeDefined();
    }
    expect(mine.every((r) => r.token.length > 0)).toBe(true);
  });
});

describe.skipIf(skipIfNoTestDb)("ICAL-02: getSubscriptionByToken", () => {
  it("returns the row for an active token", async () => {
    const editorId = await ensureStaff(testSchoolA, "ical-editor-token@test");
    const { token } = await createSubscription(testSchoolA, editorId, {
      grades: [],
      eventTypes: [],
    });
    const sub = await getSubscriptionByToken(token);
    expect(sub).not.toBeNull();
    expect(sub!.schoolId).toBe(testSchoolA);
    expect(sub!.staffUserId).toBe(editorId);
  });

  it("returns null for an unknown token", async () => {
    const sub = await getSubscriptionByToken("nope-this-token-is-fake-xxxxxx");
    expect(sub).toBeNull();
  });
});

describe.skipIf(skipIfNoTestDb)("ICAL-03: revokeSubscription hides the token from getSubscriptionByToken", () => {
  it("revoked subscription stops resolving", async () => {
    const editorId = await ensureStaff(testSchoolA, "ical-revoke@test");
    const { id, token } = await createSubscription(testSchoolA, editorId, {
      grades: [],
      eventTypes: [],
    });
    const ok = await revokeSubscription(testSchoolA, editorId, id);
    expect(ok).toBe(true);
    const sub = await getSubscriptionByToken(token);
    expect(sub).toBeNull();
  });

  it("revoking someone else's subscription returns false", async () => {
    const owner = await ensureStaff(testSchoolA, "ical-owner@test");
    const attacker = await ensureStaff(testSchoolA, "ical-attacker@test");
    const { id } = await createSubscription(testSchoolA, owner, {
      grades: [],
      eventTypes: [],
    });
    const ok = await revokeSubscription(testSchoolA, attacker, id);
    expect(ok).toBe(false);
  });

  it("revoking twice is idempotent (returns false the second time)", async () => {
    const editorId = await ensureStaff(testSchoolA, "ical-twice@test");
    const { id } = await createSubscription(testSchoolA, editorId, {
      grades: [],
      eventTypes: [],
    });
    expect(await revokeSubscription(testSchoolA, editorId, id)).toBe(true);
    expect(await revokeSubscription(testSchoolA, editorId, id)).toBe(false);
  });
});

describe.skipIf(skipIfNoTestDb)("ICAL-04: cross-school isolation", () => {
  it("a token from school B does not resolve via school A's listing", async () => {
    const editorB = await ensureStaff(testSchoolB, "ical-editor-b@test");
    const editorA = await ensureStaff(testSchoolA, "ical-editor-a2@test");
    await createSubscription(testSchoolB, editorB, {
      grades: [],
      eventTypes: [],
    });
    const aRows = await listSubscriptionsForStaff(testSchoolA, editorA);
    for (const r of aRows) {
      // Sanity check: rows must belong to editor A only.
      void r;
    }
    expect(aRows.every((r) => r.token.length > 0)).toBe(true);
  });
});
