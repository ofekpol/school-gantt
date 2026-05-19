import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createInvite } from "@/lib/db/invites";
import { createStaffUserFromInvite } from "@/lib/db/staff";
import { getEditorAllowedGrades } from "@/lib/events/queries";
import { createDraft, updateDraft } from "@/lib/events/crud";
import { publishEvent } from "@/lib/events/approval";
import { getAgendaForSchool } from "@/lib/views/agenda";
import { testDb, skipIfNoTestDb, testSchoolA } from "./setup";

/**
 * Invite → grade-scope → publish → viewer visibility tests.
 *
 * Covers:
 *   INV-01/02: createInvite stores the correct role + gradeScopes
 *   INV-03/04: createStaffUserFromInvite provisions staff_users + editor_scopes
 *   SCOPE-01/02: getEditorAllowedGrades returns the right set per user
 *   EVENT-01: editor can create and grade-scope a draft event
 *   EVENT-02: publishEvent sets status='approved' and writes a revision row
 *   VIEW-01: getAgendaForSchool includes the approved event
 */

async function ensureAdminForInviteTests(schoolId: string, email: string) {
  const existing = await testDb!
    .select()
    .from(schema.staffUsers)
    .where(
      and(eq(schema.staffUsers.schoolId, schoolId), eq(schema.staffUsers.email, email)),
    )
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({ id: randomUUID(), schoolId, email, fullName: email, role: "admin" })
    .returning();
  return row;
}

async function eventTypeFor(schoolId: string): Promise<string> {
  const [t] = await testDb!
    .select({ id: schema.eventTypes.id })
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, schoolId))
    .limit(1);
  return t.id;
}

describe.skipIf(skipIfNoTestDb)("INV-01: editor invite stores correct role + gradeScopes", () => {
  let adminId: string;

  beforeAll(async () => {
    const admin = await ensureAdminForInviteTests(testSchoolA, "invite-admin@test");
    adminId = admin.id;
  });

  it("returns a valid token and persists the invite row", async () => {
    const { token } = await createInvite({
      schoolId: testSchoolA,
      role: "editor",
      gradeScopes: [10],
      eventTypeScopes: [],
      createdBy: adminId,
      expiresInHours: 24,
    });

    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const [row] = await testDb!
      .select()
      .from(schema.staffInvites)
      .where(eq(schema.staffInvites.token, token));

    expect(row.role).toBe("editor");
    expect(row.gradeScopes).toEqual([10]);
    expect(row.eventTypeScopes).toEqual([]);
  });
});

describe.skipIf(skipIfNoTestDb)("INV-02: viewer invite stores correct role", () => {
  let adminId: string;

  beforeAll(async () => {
    const admin = await ensureAdminForInviteTests(testSchoolA, "invite-admin@test");
    adminId = admin.id;
  });

  it("returns a valid token with role=viewer and empty scopes", async () => {
    const { token } = await createInvite({
      schoolId: testSchoolA,
      role: "viewer",
      gradeScopes: [],
      eventTypeScopes: [],
      createdBy: adminId,
      expiresInHours: 24,
    });

    expect(token).toBeTruthy();

    const [row] = await testDb!
      .select()
      .from(schema.staffInvites)
      .where(eq(schema.staffInvites.token, token));

    expect(row.role).toBe("viewer");
    expect(row.gradeScopes).toEqual([]);
  });
});

describe.skipIf(skipIfNoTestDb)(
  "INV-03 + SCOPE-01: editor invite redemption provisions grade scope",
  () => {
    const editorId = randomUUID();

    it("creates staff_users row with role=editor and one editor_scopes row for grade 10", async () => {
      await createStaffUserFromInvite({
        authUserId: editorId,
        schoolId: testSchoolA,
        email: `grade10-redeemed-${editorId.slice(0, 8)}@test`,
        fullName: "Invite Editor",
        role: "editor",
        gradeScopes: [10],
      });

      const [user] = await testDb!
        .select()
        .from(schema.staffUsers)
        .where(eq(schema.staffUsers.id, editorId));

      expect(user.role).toBe("editor");
      expect(user.status).toBe("active");

      const scopes = await testDb!
        .select()
        .from(schema.editorScopes)
        .where(eq(schema.editorScopes.staffUserId, editorId));

      expect(scopes).toHaveLength(1);
      expect(scopes[0].scopeKind).toBe("grade");
      expect(scopes[0].scopeValue).toBe("10");
    });

    it("SCOPE-01: getEditorAllowedGrades returns [10] for the grade-scoped editor", async () => {
      const allowed = await getEditorAllowedGrades(testSchoolA, editorId);
      expect(allowed).toEqual([10]);
    });
  },
);

describe.skipIf(skipIfNoTestDb)(
  "INV-04 + SCOPE-02: viewer invite redemption creates no editor_scopes",
  () => {
    const viewerId = randomUUID();

    it("creates staff_users row with role=viewer and no editor_scopes", async () => {
      await createStaffUserFromInvite({
        authUserId: viewerId,
        schoolId: testSchoolA,
        email: `viewer-redeemed-${viewerId.slice(0, 8)}@test`,
        fullName: "Invite Viewer",
        role: "viewer",
        gradeScopes: [],
      });

      const [user] = await testDb!
        .select()
        .from(schema.staffUsers)
        .where(eq(schema.staffUsers.id, viewerId));

      expect(user.role).toBe("viewer");
      expect(user.status).toBe("active");

      const scopes = await testDb!
        .select()
        .from(schema.editorScopes)
        .where(eq(schema.editorScopes.staffUserId, viewerId));

      expect(scopes).toHaveLength(0);
    });

    it("SCOPE-02: getEditorAllowedGrades returns the full fallback range for viewer (no scope rows)", async () => {
      // Viewers have no editor_scopes; getEditorAllowedGrades returns 7–12 fallback.
      const allowed = await getEditorAllowedGrades(testSchoolA, viewerId);
      expect(allowed).toEqual([7, 8, 9, 10, 11, 12]);
    });
  },
);

describe.skipIf(skipIfNoTestDb)(
  "EVENT-01: editor creates draft and assigns allowed grade",
  () => {
    const editorId = randomUUID();
    let eventId: string;
    let eventVersion: number;
    let eventTypeId: string;

    beforeAll(async () => {
      await createStaffUserFromInvite({
        authUserId: editorId,
        schoolId: testSchoolA,
        email: `grade10-event-${editorId.slice(0, 8)}@test`,
        fullName: "Event Editor",
        role: "editor",
        gradeScopes: [10],
      });
      eventTypeId = await eventTypeFor(testSchoolA);
    });

    it("createDraft returns a draft event", async () => {
      const draft = await createDraft(testSchoolA, editorId, eventTypeId);
      eventId = draft.id;
      eventVersion = draft.version;

      const [row] = await testDb!
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, eventId));

      expect(row.status).toBe("draft");
      expect(row.version).toBe(1);
    });

    it("updateDraft with grade 10 succeeds and stores the grade", async () => {
      const startAt = "2026-06-15T09:00:00.000Z";
      const endAt = "2026-06-15T16:00:00.000Z";

      const result = await updateDraft(
        testSchoolA,
        eventId,
        editorId,
        false,
        { title: "Grade 10 Trip", grades: [10], startAt, endAt },
        eventVersion,
      );

      expect(result.status).toBe("ok");
      if (result.status === "ok") eventVersion = result.version;

      const grades = await testDb!
        .select()
        .from(schema.eventGrades)
        .where(eq(schema.eventGrades.eventId, eventId));

      expect(grades.map((g) => g.grade)).toEqual([10]);
    });
  },
);

describe.skipIf(skipIfNoTestDb)(
  "EVENT-02 + VIEW-01: publishEvent sets status=approved and event appears in public view",
  () => {
    const editorId = randomUUID();
    let eventId: string;
    let eventVersion: number;
    let eventTypeId: string;

    beforeAll(async () => {
      await createStaffUserFromInvite({
        authUserId: editorId,
        schoolId: testSchoolA,
        email: `grade10-publish-${editorId.slice(0, 8)}@test`,
        fullName: "Publishing Editor",
        role: "editor",
        gradeScopes: [10],
      });
      eventTypeId = await eventTypeFor(testSchoolA);

      const draft = await createDraft(testSchoolA, editorId, eventTypeId);
      eventId = draft.id;
      eventVersion = draft.version;

      const startAt = "2026-06-20T09:00:00.000Z";
      const endAt = "2026-06-20T16:00:00.000Z";
      const updated = await updateDraft(
        testSchoolA,
        eventId,
        editorId,
        false,
        { title: "Published Grade 10 Event", grades: [10], startAt, endAt },
        eventVersion,
      );
      if (updated.status === "ok") eventVersion = updated.version;
    });

    it("publishEvent transitions draft → approved and writes a 'published' revision row", async () => {
      await publishEvent(testSchoolA, eventId, editorId);

      const [row] = await testDb!
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, eventId));

      expect(row.status).toBe("approved");

      const revisions = await testDb!
        .select()
        .from(schema.eventRevisions)
        .where(eq(schema.eventRevisions.eventId, eventId));

      expect(revisions.length).toBeGreaterThan(0);
      expect(revisions[revisions.length - 1].decision).toBe("published");
    });

    it("VIEW-01: getAgendaForSchool includes the approved event", async () => {
      const items = await getAgendaForSchool(testSchoolA, {});
      const found = items.find((i) => i.id === eventId);

      expect(found).toBeDefined();
      expect(found?.title).toBe("Published Grade 10 Event");
      expect(found?.grades).toContain(10);
    });
  },
);
