import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { testDb, skipIfNoTestDb } from "./setup";

describe.skipIf(skipIfNoTestDb)("DB-06: seed creates canonical bootstrap", () => {
  beforeAll(() => {
    // Run seed against TEST_DATABASE_URL — creates/updates auth users in configured Supabase project.
    // Timeout is high because Supabase auth.admin.createUser makes network calls per user (8 users).
    execSync("pnpm seed", {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      stdio: "inherit",
    });
  }, 60_000);

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
    execSync("pnpm seed", {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      stdio: "pipe",
    });
    const afterUsers = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.schoolId, school.id));
    expect(afterUsers).toHaveLength(beforeUsers.length);
  });
});
