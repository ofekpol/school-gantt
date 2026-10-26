import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { withSchool } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { createStaffUserFromInvite, updateStaffUser } from "@/lib/db/staff";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

const getStaffUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getStaffUser: (...args: unknown[]) => getStaffUserMock(...args),
}));

const signOutMock = vi.fn();
vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: { auth: { admin: { signOut: (...args: unknown[]) => signOutMock(...args) } } },
}));

// ─────────────────────────────────────────────────────────────────────────────
// XSCHOOL-STAFF: an admin of school B cannot touch school A's staff
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("XSCHOOL-STAFF: updateStaffUser across schools", () => {
  let editorA: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorA = randomUUID();
    await createStaffUserFromInvite({
      authUserId: editorA,
      schoolId: testSchoolA,
      email: `xschool-editor-${editorA}@test`,
      fullName: "Editor A",
      role: "editor",
      gradeScopes: [9],
    });
  });

  beforeEach(() => signOutMock.mockReset());

  async function rowA() {
    const [row] = await testDb!.select().from(schema.staffUsers).where(eq(schema.staffUsers.id, editorA));
    return row;
  }

  async function scopesA() {
    return testDb!
      .select({ value: schema.editorScopes.scopeValue })
      .from(schema.editorScopes)
      .where(eq(schema.editorScopes.staffUserId, editorA));
  }

  it("rename from school B throws 404 and changes nothing", async () => {
    await expect(updateStaffUser(testSchoolB, editorA, { fullName: "Hijacked" })).rejects.toMatchObject({
      status: 404,
    });
    expect((await rowA()).fullName).toBe("Editor A");
  });

  it("scope-only update from school B leaves A's editor_scopes intact", async () => {
    await expect(updateStaffUser(testSchoolB, editorA, { gradeScopes: [7] })).rejects.toMatchObject({
      status: 404,
    });
    expect((await scopesA()).map((s) => s.value)).toEqual(["9"]);
  });

  it("deactivate from school B never calls signOut", async () => {
    await expect(updateStaffUser(testSchoolB, editorA, { deactivated: true })).rejects.toMatchObject({
      status: 404,
    });
    expect(signOutMock).not.toHaveBeenCalled();
    expect((await rowA()).status).toBe("active");
  });

  it("deactivate from school A still signs the user out", async () => {
    await updateStaffUser(testSchoolA, editorA, { deactivated: true });
    expect(signOutMock).toHaveBeenCalledWith(editorA, "global");
    await updateStaffUser(testSchoolA, editorA, { deactivated: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures: one row per school-scoped table, owned by school A
// ─────────────────────────────────────────────────────────────────────────────

interface SchoolAFixture {
  adminA: string;
  eventTypeId: string;
  eventId: string;
  academicYearId: string;
  editorScopeId: string;
  inviteId: string;
  dismissalId: string;
  revisionId: string;
  auditId: string;
  subscriptionId: string;
}

async function firstId(rows: Promise<Array<{ id: string }>>): Promise<string> {
  const [row] = await rows;
  return row.id;
}

async function createAdmin(schoolId: string, label: string): Promise<string> {
  const id = randomUUID();
  await createStaffUserFromInvite({
    authUserId: id,
    schoolId,
    email: `xschool-${label}-${id}@test`,
    fullName: label,
    role: "admin",
  });
  return id;
}

async function insertEventA(adminA: string, eventTypeId: string): Promise<string> {
  return firstId(
    testDb!
      .insert(schema.events)
      .values({
        schoolId: testSchoolA,
        eventTypeId,
        title: "School A secret",
        startAt: new Date("2026-11-01T08:00:00Z"),
        endAt: new Date("2026-11-01T10:00:00Z"),
        status: "approved",
        createdBy: adminA,
      })
      .returning({ id: schema.events.id }),
  );
}

async function buildSchoolAFixture(): Promise<SchoolAFixture> {
  const db = testDb!;
  const adminA = await createAdmin(testSchoolA, "admin-a");
  const [et] = await db
    .select({ id: schema.eventTypes.id })
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, testSchoolA))
    .limit(1);
  const eventId = await insertEventA(adminA, et.id);
  const s = { schoolId: testSchoolA };
  return {
    adminA,
    eventTypeId: et.id,
    eventId,
    academicYearId: await firstId(
      db.insert(schema.academicYears)
        .values({ ...s, label: `xschool-${adminA}`, startDate: "2030-09-01", endDate: "2031-07-31" })
        .returning({ id: schema.academicYears.id }),
    ),
    editorScopeId: await firstId(
      db.insert(schema.editorScopes)
        .values({ ...s, staffUserId: adminA, scopeKind: "grade", scopeValue: "10" })
        .returning({ id: schema.editorScopes.id }),
    ),
    inviteId: await firstId(
      db.insert(schema.staffInvites).values({ ...s, createdBy: adminA }).returning({ id: schema.staffInvites.id }),
    ),
    dismissalId: await firstId(
      db.insert(schema.staffEventDismissals)
        .values({ ...s, staffUserId: adminA, eventId })
        .returning({ id: schema.staffEventDismissals.id }),
    ),
    revisionId: await firstId(
      db.insert(schema.eventRevisions)
        .values({ ...s, eventId, snapshot: { title: "School A secret" }, decision: "published" })
        .returning({ id: schema.eventRevisions.id }),
    ),
    auditId: await firstId(
      db.insert(schema.auditLog)
        .values({ ...s, actorStaffId: adminA, action: "test", targetTable: "events", targetId: eventId })
        .returning({ id: schema.auditLog.id }),
    ),
    subscriptionId: await firstId(
      db.insert(schema.icalSubscriptions)
        .values({ ...s, staffUserId: adminA, token: `xschool-${randomUUID()}` })
        .returning({ id: schema.icalSubscriptions.id }),
    ),
  };
}

/** Rows `schoolId` can see / update / delete for one id, inside its own RLS context. */
async function reachFrom(schoolId: string, table: string, id: string, mutate: boolean) {
  return withSchool(schoolId, async (tx) => {
    const t = sql.identifier(table);
    const seen = (await tx.execute(sql`SELECT id FROM ${t} WHERE id = ${id}`)).rows.length;
    if (!mutate) return { seen, updated: 0, deleted: 0 };
    const updated = (
      await tx.execute(sql`UPDATE ${t} SET school_id = school_id WHERE id = ${id} RETURNING id`)
    ).rows.length;
    const deleted = (await tx.execute(sql`DELETE FROM ${t} WHERE id = ${id} RETURNING id`)).rows.length;
    return { seen, updated, deleted };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// XSCHOOL-RLS: every school-scoped table denies school B
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("XSCHOOL-RLS: school B cannot reach school A rows", () => {
  let fx: SchoolAFixture;

  beforeAll(async () => {
    if (shouldSkip()) return;
    fx = await buildSchoolAFixture();
  });

  const cases: Array<[string, (f: SchoolAFixture) => string]> = [
    ["audit_log", (f) => f.auditId],
    ["academic_years", (f) => f.academicYearId],
    ["editor_scopes", (f) => f.editorScopeId],
    ["staff_invites", (f) => f.inviteId],
    ["staff_event_dismissals", (f) => f.dismissalId],
    ["event_revisions", (f) => f.revisionId],
    ["events", (f) => f.eventId],
    ["event_types", (f) => f.eventTypeId],
    ["ical_subscriptions", (f) => f.subscriptionId],
    ["staff_users", (f) => f.adminA],
  ];

  it.each(cases)("%s: school B cannot read, update or delete school A rows", async (table, pick) => {
    // Positive control: school A sees the row, so the zeros below come from RLS, not a bad fixture.
    expect((await reachFrom(testSchoolA, table, pick(fx), false)).seen).toBe(1);
    expect(await reachFrom(testSchoolB, table, pick(fx), true)).toEqual({ seen: 0, updated: 0, deleted: 0 });
    expect((await reachFrom(testSchoolA, table, pick(fx), false)).seen).toBe(1);
  });

  it("school B cannot insert rows tagged with school A (WITH CHECK)", async () => {
    await expect(
      withSchool(testSchoolB, (tx) =>
        tx.insert(schema.auditLog).values({ schoolId: testSchoolA, action: "forged", targetTable: "events" }),
      ),
    ).rejects.toThrow();
    await expect(
      withSchool(testSchoolB, (tx) =>
        tx.insert(schema.academicYears).values({
          schoolId: testSchoolA,
          label: `forged-${randomUUID()}`,
          startDate: "2031-09-01",
          endDate: "2032-07-31",
        }),
      ),
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// XSCHOOL-ROUTES: school B's admin hitting school A ids through the API
// ─────────────────────────────────────────────────────────────────────────────

function apiRequest(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/v1/x", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json", ...headers },
  });
}

const idContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe.skipIf(skipIfNoTestDb)("XSCHOOL-ROUTES: admin of school B calls routes with school A ids", () => {
  let fx: SchoolAFixture;

  beforeAll(async () => {
    if (shouldSkip()) return;
    fx = await buildSchoolAFixture();
    const adminB = await createAdmin(testSchoolB, "admin-b");
    getStaffUserMock.mockResolvedValue({
      id: adminB,
      schoolId: testSchoolB,
      schoolSlug: "test-b",
      role: "admin",
      status: "active",
      mustChangePassword: false,
      email: `xschool-admin-b-${adminB}@test`,
      fullName: "admin-b",
    });
  });

  async function eventA() {
    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, fx.eventId));
    return row;
  }

  it("GET /events/[id] is 404", async () => {
    const { GET } = await import("@/app/api/v1/events/[id]/route");
    expect((await GET(apiRequest("GET"), idContext(fx.eventId))).status).toBe(404);
  });

  it("PATCH /events/[id] fails and leaves the event unchanged", async () => {
    const { PATCH } = await import("@/app/api/v1/events/[id]/route");
    const res = await PATCH(apiRequest("PATCH", { title: "hijacked" }, { "If-Match": "1" }), idContext(fx.eventId));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await eventA()).title).toBe("School A secret");
  });

  it("POST /events/[id]/submit fails and leaves the event unchanged", async () => {
    const { POST } = await import("@/app/api/v1/events/[id]/submit/route");
    const res = await POST(apiRequest("POST", { title: "hijacked" }), idContext(fx.eventId));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await eventA()).title).toBe("School A secret");
  });

  it("DELETE /events/[id] fails and does not soft-delete", async () => {
    const { DELETE } = await import("@/app/api/v1/events/[id]/route");
    const res = await DELETE(apiRequest("DELETE"), idContext(fx.eventId));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await eventA()).deletedAt).toBeNull();
  });

  it("PATCH and DELETE /admin/event-types/[id] are 404 and change nothing", async () => {
    const { PATCH, DELETE } = await import("@/app/api/v1/admin/event-types/[id]/route");
    expect((await PATCH(apiRequest("PATCH", { labelEn: "Hijacked" }), idContext(fx.eventTypeId))).status).toBe(404);
    expect((await DELETE(apiRequest("DELETE"), idContext(fx.eventTypeId))).status).toBe(404);
    const [et] = await testDb!.select().from(schema.eventTypes).where(eq(schema.eventTypes.id, fx.eventTypeId));
    expect(et.labelEn).not.toBe("Hijacked");
  });

  it("DELETE /admin/staff/invites/[id] does not revoke the school A invite", async () => {
    const { DELETE } = await import("@/app/api/v1/admin/staff/invites/[id]/route");
    await DELETE(apiRequest("DELETE"), idContext(fx.inviteId));
    const [inv] = await testDb!.select().from(schema.staffInvites).where(eq(schema.staffInvites.id, fx.inviteId));
    expect(inv.revokedAt).toBeNull();
  });

  it("DELETE /ical-subscriptions/[id] is 404 and does not revoke", async () => {
    const { DELETE } = await import("@/app/api/v1/ical-subscriptions/[id]/route");
    expect((await DELETE(apiRequest("DELETE"), idContext(fx.subscriptionId))).status).toBe(404);
    const [sub] = await testDb!
      .select()
      .from(schema.icalSubscriptions)
      .where(eq(schema.icalSubscriptions.id, fx.subscriptionId));
    expect(sub.revokedAt).toBeNull();
  });

  it("PATCH /admin/staff/[id] is 404 for the school A admin", async () => {
    const { PATCH } = await import("@/app/api/v1/admin/staff/[id]/route");
    expect((await PATCH(apiRequest("PATCH", { fullName: "Hijacked" }), idContext(fx.adminA))).status).toBe(404);
  });
});
