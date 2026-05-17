import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { seedDb } from "@/db/seed";
import { testDb, skipIfNoTestDb } from "./setup";

// Deterministic UUID per email — stable across runs so re-seeding upserts the
// same staff_users row (the email-conflict path keeps the original id, and
// editor_scopes references must resolve).
function deterministicUuid(email: string): string {
  const h = createHash("sha256").update(email).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

async function runSeed() {
  if (!testDb) throw new Error("testDb is null — TEST_DATABASE_URL not set");
  return seedDb({
    database: testDb,
    ensureStaffUserId: async (email) => deterministicUuid(email),
  });
}

describe.skipIf(skipIfNoTestDb)("DB-06: seed creates canonical bootstrap", () => {
  beforeAll(async () => {
    await runSeed();
  }, 30_000);

  it("creates exactly one school with slug 'demo-school'", async () => {
    const rows = await testDb!
      .select()
      .from(schema.schools)
      .where(eq(schema.schools.slug, "demo-school"));
    expect(rows).toHaveLength(1);
  });

  it("creates one admin staff_user", async () => {
    const [school] = await testDb!
      .select()
      .from(schema.schools)
      .where(eq(schema.schools.slug, "demo-school"));
    const admins = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(
        and(
          eq(schema.staffUsers.schoolId, school.id),
          eq(schema.staffUsers.role, "admin"),
        ),
      );
    expect(admins).toHaveLength(1);
  });

  it("creates 6 grade-supervisor editors (grades 7-12)", async () => {
    const [school] = await testDb!
      .select()
      .from(schema.schools)
      .where(eq(schema.schools.slug, "demo-school"));
    const scopes = await testDb!
      .select()
      .from(schema.editorScopes)
      .where(
        and(
          eq(schema.editorScopes.schoolId, school.id),
          eq(schema.editorScopes.scopeKind, "grade"),
        ),
      );
    const grades = scopes.map((s) => Number(s.scopeValue)).sort((a, b) => a - b);
    expect(grades).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("creates one counselor editor with event_type scope", async () => {
    const [school] = await testDb!
      .select()
      .from(schema.schools)
      .where(eq(schema.schools.slug, "demo-school"));
    const eventTypeScopes = await testDb!
      .select()
      .from(schema.editorScopes)
      .where(
        and(
          eq(schema.editorScopes.schoolId, school.id),
          eq(schema.editorScopes.scopeKind, "event_type"),
        ),
      );
    expect(eventTypeScopes).toHaveLength(1);
    expect(eventTypeScopes[0].scopeValue).toBe("counseling");
  });

  it("creates exactly 11 event_types", async () => {
    const [school] = await testDb!
      .select()
      .from(schema.schools)
      .where(eq(schema.schools.slug, "demo-school"));
    const types = await testDb!
      .select()
      .from(schema.eventTypes)
      .where(eq(schema.eventTypes.schoolId, school.id));
    expect(types).toHaveLength(11);
  });

  it("re-running seed does not duplicate any rows (idempotent)", async () => {
    const [school] = await testDb!
      .select()
      .from(schema.schools)
      .where(eq(schema.schools.slug, "demo-school"));
    const beforeUsers = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.schoolId, school.id));
    await runSeed();
    const afterUsers = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.schoolId, school.id));
    expect(afterUsers).toHaveLength(beforeUsers.length);
  });
});
