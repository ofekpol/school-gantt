import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createDraft, softDelete, updateDraft } from "@/lib/events/crud";
import { publishEvent } from "@/lib/events/approval";
import {
  getActiveAcademicYear,
  getDraftForResume,
  getEditorAllowedGrades,
  getEditorDashboardEvents,
  getEventForEditor,
} from "@/lib/events/queries";
import { assertEditorScope } from "@/lib/auth/scopes";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA } from "./setup";

// ─── Shared helpers ─────────────────────────────────────────────────────────

async function ensureEditor(
  schoolId: string,
  email: string,
  role: "editor" | "admin" = "editor",
) {
  const existing = await testDb!
    .select()
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.email, email))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({ id: randomUUID(), schoolId, email, fullName: email, role, status: "active" })
    .returning();
  return row;
}

async function firstEventType(schoolId: string): Promise<string> {
  const [t] = await testDb!
    .select({ id: schema.eventTypes.id })
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, schoolId))
    .limit(1);
  return t.id;
}

async function addGradeScope(staffUserId: string, schoolId: string, grade: number) {
  await testDb!
    .insert(schema.editorScopes)
    .values({ staffUserId, schoolId, scopeKind: "grade", scopeValue: String(grade) })
    .onConflictDoNothing();
}

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-01: createDraft persists a draft row owned by the editor's school
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-01: wizard open creates a draft", () => {
  let editorId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorId = (await ensureEditor(testSchoolA, "wiz-create@test")).id;
    eventTypeId = await firstEventType(testSchoolA);
  });

  it("createDraft persists a row with status=draft", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    const [row] = await testDb!
      .select({ status: schema.events.status })
      .from(schema.events)
      .where(eq(schema.events.id, id));
    expect(row.status).toBe("draft");
  });

  it("createDraft returns version 1 for a new draft", async () => {
    const { version } = await createDraft(testSchoolA, editorId, eventTypeId);
    expect(version).toBe(1);
  });

  it("created draft belongs to the editor's school", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    const [row] = await testDb!
      .select({ schoolId: schema.events.schoolId, createdBy: schema.events.createdBy })
      .from(schema.events)
      .where(eq(schema.events.id, id));
    expect(row.schoolId).toBe(testSchoolA);
    expect(row.createdBy).toBe(editorId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-02: autosave updates the draft on every step (updateDraft)
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-02: wizard autosaves draft on every step", () => {
  let editorId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorId = (await ensureEditor(testSchoolA, "wiz-autosave@test")).id;
    eventTypeId = await firstEventType(testSchoolA);
  });

  it("updateDraft with step data updates the draft", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await updateDraft(testSchoolA, id, editorId, false, { title: "Field Trip" }, null);
    const r = await getEventForEditor(testSchoolA, id, editorId, false);
    expect(r?.event.title).toBe("Field Trip");
  });

  it("partial step data (title only) is persisted without error", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    const result = await updateDraft(testSchoolA, id, editorId, false, { title: "Step 1" }, null);
    expect(result.status).toBe("ok");
  });

  it("autosave returns the incremented event version number", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    const result = await updateDraft(testSchoolA, id, editorId, false, { title: "v2" }, null);
    expect(result).toEqual({ status: "ok", version: 2 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-03: editor can resume a draft from /dashboard
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-03: editor can resume draft from dashboard", () => {
  let editorId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorId = (await ensureEditor(testSchoolA, "wiz-resume@test")).id;
    eventTypeId = await firstEventType(testSchoolA);
  });

  it("dashboard returns the editor's incomplete drafts", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    const list = await getEditorDashboardEvents(testSchoolA, editorId);
    expect(list.some((e) => e.id === id && e.status === "draft")).toBe(true);
  });

  it("resumed draft contains all previously saved step data", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await updateDraft(testSchoolA, id, editorId, false, { title: "Saved", location: "Gym" }, null);
    const draft = await getDraftForResume(testSchoolA, id, editorId);
    expect(draft?.title).toBe("Saved");
    expect(draft?.location).toBe("Gym");
  });

  it("draft has no expiry — remains retrievable after save", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    const draft = await getDraftForResume(testSchoolA, id, editorId);
    expect(draft).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-04: date picker bounded by active academic year
// Server does not enforce 422; getActiveAcademicYear supplies the picker bounds.
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-04: date picker bounded by active academic year", () => {
  beforeAll(async () => {
    if (shouldSkip()) return;
    const label = `wiz-yr-${randomUUID().slice(0, 8)}`;
    const [year] = await testDb!
      .insert(schema.academicYears)
      .values({
        schoolId: testSchoolA,
        label,
        startDate: "2030-09-01",
        endDate: "2031-07-31",
      })
      .returning({ id: schema.academicYears.id });
    await testDb!
      .update(schema.schools)
      .set({ activeAcademicYearId: year.id })
      .where(eq(schema.schools.id, testSchoolA));
  });

  it("active academic year exposes start and end bounds for the picker", async () => {
    const year = await getActiveAcademicYear(testSchoolA);
    expect(year?.startDate).toBe("2030-09-01");
    expect(year?.endDate).toBe("2031-07-31");
  });

  it("a date before the year start is outside the picker bounds", async () => {
    const year = await getActiveAcademicYear(testSchoolA);
    const within = "2030-08-31" >= year!.startDate && "2030-08-31" <= year!.endDate;
    expect(within).toBe(false);
  });

  it("a date within the year boundaries is inside the picker bounds", async () => {
    const year = await getActiveAcademicYear(testSchoolA);
    const within = "2031-01-15" >= year!.startDate && "2031-01-15" <= year!.endDate;
    expect(within).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-05: grade multi-select respects editor scope
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-05: grade multi-select respects editor scope", () => {
  let scopedEditorId: string;
  let adminId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    scopedEditorId = (await ensureEditor(testSchoolA, "wiz-scope10@test")).id;
    await addGradeScope(scopedEditorId, testSchoolA, 10);
    adminId = (await ensureEditor(testSchoolA, "wiz-admin@test", "admin")).id;
  });

  it("editor with grade=10 scope is allowed to select grade 10", async () => {
    const allowed = await getEditorAllowedGrades(testSchoolA, scopedEditorId);
    expect(allowed).toContain(10);
  });

  it("editor with grade=10 scope cannot select grade 11", async () => {
    const allowed = await getEditorAllowedGrades(testSchoolA, scopedEditorId);
    expect(allowed).not.toContain(11);
    await expect(
      assertEditorScope(
        { id: scopedEditorId, schoolId: testSchoolA, role: "editor", status: "active" },
        11,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("admin can select any grade without scope restriction", async () => {
    await expect(
      assertEditorScope(
        { id: adminId, schoolId: testSchoolA, role: "admin", status: "active" },
        11,
      ),
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-06: Step 7 publish flips status draft → approved (no pending stage)
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-06: Step 7 publish flips draft to approved", () => {
  let editorId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorId = (await ensureEditor(testSchoolA, "wiz-publish@test")).id;
    eventTypeId = await firstEventType(testSchoolA);
  });

  it("publishEvent changes status from draft to approved", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);
    const [row] = await testDb!
      .select({ status: schema.events.status })
      .from(schema.events)
      .where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");
  });

  it("publish writes a 'published' revision row", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);
    const revs = await testDb!
      .select({ decision: schema.eventRevisions.decision })
      .from(schema.eventRevisions)
      .where(eq(schema.eventRevisions.eventId, id));
    expect(revs).toHaveLength(1);
    expect(revs[0].decision).toBe("published");
  });

  it("published event has status=approved so public views include it", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);
    const r = await getEventForEditor(testSchoolA, id, editorId, false);
    // Public views filter on status='approved'; a draft (the pre-publish state) is excluded.
    expect(r?.event.status).toBe("approved");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-07: dashboard shows the editor's draft and approved events
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-07: dashboard shows editor's events by status", () => {
  let editorId: string;
  let otherEditorId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorId = (await ensureEditor(testSchoolA, "wiz-dash@test")).id;
    otherEditorId = (await ensureEditor(testSchoolA, "wiz-dash-other@test")).id;
    eventTypeId = await firstEventType(testSchoolA);
  });

  it("dashboard returns both draft and approved events for the editor", async () => {
    const draft = await createDraft(testSchoolA, editorId, eventTypeId);
    const published = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, published.id, editorId);
    const list = await getEditorDashboardEvents(testSchoolA, editorId);
    const byId = new Map(list.map((e) => [e.id, e.status]));
    expect(byId.get(draft.id)).toBe("draft");
    expect(byId.get(published.id)).toBe("approved");
  });

  it("every returned event has a draft or approved status", async () => {
    await createDraft(testSchoolA, editorId, eventTypeId);
    const list = await getEditorDashboardEvents(testSchoolA, editorId);
    expect(list.every((e) => e.status === "draft" || e.status === "approved")).toBe(true);
  });

  it("editor cannot see another editor's events", async () => {
    const { id } = await createDraft(testSchoolA, otherEditorId, eventTypeId);
    const list = await getEditorDashboardEvents(testSchoolA, editorId);
    expect(list.some((e) => e.id === id)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-08: editor can soft-delete their own draft events
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-08: editor can soft-delete their own draft events", () => {
  let editorId: string;
  let otherEditorId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorId = (await ensureEditor(testSchoolA, "wiz-del@test")).id;
    otherEditorId = (await ensureEditor(testSchoolA, "wiz-del-other@test")).id;
    eventTypeId = await firstEventType(testSchoolA);
  });

  it("softDelete sets deletedAt on the editor's own draft", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    const result = await softDelete(testSchoolA, id, editorId);
    expect(result.deleted).toBe(true);
    const [row] = await testDb!
      .select({ deletedAt: schema.events.deletedAt })
      .from(schema.events)
      .where(eq(schema.events.id, id));
    expect(row.deletedAt).not.toBeNull();
  });

  it("soft-deleted event no longer appears on the dashboard", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await softDelete(testSchoolA, id, editorId);
    const list = await getEditorDashboardEvents(testSchoolA, editorId);
    expect(list.some((e) => e.id === id)).toBe(false);
  });

  it("editor cannot delete another editor's event", async () => {
    const { id } = await createDraft(testSchoolA, otherEditorId, eventTypeId);
    const result = await softDelete(testSchoolA, id, editorId);
    expect(result.deleted).toBe(false);
  });

  it("an approved event cannot be soft-deleted by an editor", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);
    const result = await softDelete(testSchoolA, id, editorId);
    expect(result.deleted).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD-09: concurrent edit version conflict detection (optimistic locking)
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("WIZARD-09: concurrent edit version conflict detection", () => {
  let editorId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorId = (await ensureEditor(testSchoolA, "wiz-conflict@test")).id;
    eventTypeId = await firstEventType(testSchoolA);
  });

  it("update with a stale expected version returns a conflict", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await updateDraft(testSchoolA, id, editorId, false, { title: "first" }, 1); // → v2
    const stale = await updateDraft(testSchoolA, id, editorId, false, { title: "stale" }, 1);
    expect(stale.status).toBe("conflict");
  });

  it("update with a matching expected version succeeds and increments version", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    const result = await updateDraft(testSchoolA, id, editorId, false, { title: "ok" }, 1);
    expect(result).toEqual({ status: "ok", version: 2 });
  });

  it("after a conflict the client can read the current version to warn the user", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await updateDraft(testSchoolA, id, editorId, false, { title: "first" }, 1); // → v2
    const stale = await updateDraft(testSchoolA, id, editorId, false, { title: "stale" }, 1);
    expect(stale.status).toBe("conflict");
    const current = await getEventForEditor(testSchoolA, id, editorId, false);
    expect(current?.event.version).toBe(2);
  });
});
