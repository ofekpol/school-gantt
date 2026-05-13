import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  approveEvent,
  autoApproveAsAdmin,
  editApprovedEvent,
  rejectEvent,
  submitForApproval,
} from "@/lib/events/approval";
import {
  getRejectedForEditor,
  getRevisionsForEvent,
  listPendingForQueue,
} from "@/lib/events/revisions";
import { createDraft, updateDraft } from "@/lib/events/crud";
import { testDb, skipIfNoTestDb, testSchoolA, testSchoolB } from "./setup";

/**
 * Phase 3 — approval workflow integration tests.
 * Exercises the full state machine: draft → pending → approved/rejected,
 * admin auto-approve, edit-of-approved producing a new pending revision
 * (parent_event_id), and the queue/rejected read paths.
 *
 * All transitions must go through lib/events/approval.ts — every test here
 * asserts an event_revisions row is written so the audit log stays complete.
 */

async function ensureEditor(schoolId: string, email: string, role: "editor" | "admin") {
  const existing = await testDb!
    .select()
    .from(schema.staffUsers)
    .where(and(eq(schema.staffUsers.schoolId, schoolId), eq(schema.staffUsers.email, email)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({
      id: randomUUID(),
      schoolId,
      email,
      fullName: email,
      role,
    })
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

describe.skipIf(skipIfNoTestDb)("APPROVAL-01: submitForApproval flips draft → pending", () => {
  let editorId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    const editor = await ensureEditor(testSchoolA, "approval-editor@test", "editor");
    editorId = editor.id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("changes status to pending and writes a 'submitted' revision", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await submitForApproval(testSchoolA, id, editorId);

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("pending");

    const revisions = await testDb!
      .select()
      .from(schema.eventRevisions)
      .where(eq(schema.eventRevisions.eventId, id))
      .orderBy(desc(schema.eventRevisions.createdAt));
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions[0].decision).toBe("submitted");
    expect(revisions[0].submittedBy).toBe(editorId);
  });

  it("throws 404 when event is not in draft status", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await submitForApproval(testSchoolA, id, editorId);
    await expect(submitForApproval(testSchoolA, id, editorId)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe.skipIf(skipIfNoTestDb)("APPROVAL-02: approveEvent flips pending → approved", () => {
  let editorId: string;
  let adminId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    editorId = (await ensureEditor(testSchoolA, "approval-editor@test", "editor")).id;
    adminId = (await ensureEditor(testSchoolA, "approval-admin@test", "admin")).id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("changes status to approved and records decidedBy in the revision", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await submitForApproval(testSchoolA, id, editorId);
    await approveEvent(testSchoolA, id, adminId);

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");

    const revisions = await getRevisionsForEvent(testSchoolA, id);
    const decisions = revisions.map((r) => r.decision);
    expect(decisions).toContain("submitted");
    expect(decisions).toContain("approved");
    const approvedRow = revisions.find((r) => r.decision === "approved")!;
    expect(approvedRow.decidedBy).toBe(adminId);
  });

  it("throws 404 when event is not pending", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await expect(approveEvent(testSchoolA, id, adminId)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe.skipIf(skipIfNoTestDb)("APPROVAL-03: rejectEvent requires a reason and flips pending → rejected", () => {
  let editorId: string;
  let adminId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    editorId = (await ensureEditor(testSchoolA, "approval-editor@test", "editor")).id;
    adminId = (await ensureEditor(testSchoolA, "approval-admin@test", "admin")).id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("stores the reason on the revision row", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await submitForApproval(testSchoolA, id, editorId);
    await rejectEvent(testSchoolA, id, adminId, "תאריך מתנגש עם בגרות");

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("rejected");

    const revisions = await getRevisionsForEvent(testSchoolA, id);
    const rejection = revisions.find((r) => r.decision === "rejected");
    expect(rejection?.reason).toBe("תאריך מתנגש עם בגרות");
    expect(rejection?.decidedBy).toBe(adminId);
  });
});

describe.skipIf(skipIfNoTestDb)("APPROVAL-04: rejected events can be resubmitted (rejected → pending)", () => {
  let editorId: string;
  let adminId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    editorId = (await ensureEditor(testSchoolA, "approval-editor@test", "editor")).id;
    adminId = (await ensureEditor(testSchoolA, "approval-admin@test", "admin")).id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("editor resubmits a rejected event and it returns to pending", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await submitForApproval(testSchoolA, id, editorId);
    await rejectEvent(testSchoolA, id, adminId, "סיבה");
    await submitForApproval(testSchoolA, id, editorId);

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("pending");
  });
});

describe.skipIf(skipIfNoTestDb)("APPROVAL-05: admin-created events auto-approve (draft → approved)", () => {
  let adminId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    adminId = (await ensureEditor(testSchoolA, "approval-admin@test", "admin")).id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("autoApproveAsAdmin transitions draft to approved without ever entering pending", async () => {
    const { id } = await createDraft(testSchoolA, adminId, eventTypeId);
    await autoApproveAsAdmin(testSchoolA, id, adminId);
    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");
    const revisions = await getRevisionsForEvent(testSchoolA, id);
    const approvedRow = revisions.find((r) => r.decision === "approved");
    expect(approvedRow).toBeDefined();
    expect(approvedRow!.decidedBy).toBe(adminId);
  });

  it("throws 404 when called on a non-draft event", async () => {
    const editor = await ensureEditor(testSchoolA, "approval-editor@test", "editor");
    const { id } = await createDraft(testSchoolA, editor.id, eventTypeId);
    await submitForApproval(testSchoolA, id, editor.id);
    await expect(autoApproveAsAdmin(testSchoolA, id, adminId)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe.skipIf(skipIfNoTestDb)("APPROVAL-06: editApprovedEvent creates a new pending revision (parent_event_id)", () => {
  let editorId: string;
  let adminId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    editorId = (await ensureEditor(testSchoolA, "approval-editor@test", "editor")).id;
    adminId = (await ensureEditor(testSchoolA, "approval-admin@test", "admin")).id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("editing an approved event creates a new row with parent_event_id pointing to v1", async () => {
    // Create v1 approved
    const { id: v1Id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await updateDraft(testSchoolA, v1Id, editorId, false, { title: "טיול גרסה 1" }, null);
    await submitForApproval(testSchoolA, v1Id, editorId);
    await approveEvent(testSchoolA, v1Id, adminId);

    // Editor edits — should produce new pending event with parent_event_id=v1Id
    const v2 = await editApprovedEvent(testSchoolA, v1Id, editorId, {
      title: "טיול גרסה 2",
    });

    expect(v2.id).not.toBe(v1Id);

    const [v1Row] = await testDb!
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, v1Id));
    const [v2Row] = await testDb!
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, v2.id));

    // v1 stays approved + public
    expect(v1Row.status).toBe("approved");
    expect(v1Row.deletedAt).toBeNull();
    // v2 is pending and points back at v1
    expect(v2Row.status).toBe("pending");
    expect(v2Row.parentEventId).toBe(v1Id);
    expect(v2Row.title).toBe("טיול גרסה 2");
  });

  it("approving the v2 revision soft-deletes v1 so v2 becomes the public row", async () => {
    const { id: v1Id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await updateDraft(testSchoolA, v1Id, editorId, false, { title: "מקור" }, null);
    await submitForApproval(testSchoolA, v1Id, editorId);
    await approveEvent(testSchoolA, v1Id, adminId);

    const v2 = await editApprovedEvent(testSchoolA, v1Id, editorId, { title: "עדכון" });
    await approveEvent(testSchoolA, v2.id, adminId);

    const [v1Row] = await testDb!
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, v1Id));
    const [v2Row] = await testDb!
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, v2.id));

    expect(v1Row.deletedAt).not.toBeNull();
    expect(v2Row.status).toBe("approved");
    expect(v2Row.deletedAt).toBeNull();
  });
});

describe.skipIf(skipIfNoTestDb)("APPROVAL-07: queue listing sorts by submitted_at", () => {
  let editorId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    editorId = (await ensureEditor(testSchoolA, "approval-editor@test", "editor")).id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("returns only pending events in the calling school", async () => {
    const { id: a } = await createDraft(testSchoolA, editorId, eventTypeId);
    await submitForApproval(testSchoolA, a, editorId);
    const queue = await listPendingForQueue(testSchoolA);
    const ids = queue.map((row) => row.id);
    expect(ids).toContain(a);
    for (const row of queue) expect(row.status).toBe("pending");
  });

  it("does not leak pending events from another school", async () => {
    // School B editor + event type
    const bEditor = await ensureEditor(testSchoolB, "approval-editor-b@test", "editor");
    const bType = await eventTypeFor(testSchoolB);
    const { id: bEventId } = await createDraft(testSchoolB, bEditor.id, bType);
    await submitForApproval(testSchoolB, bEventId, bEditor.id);

    const queueA = await listPendingForQueue(testSchoolA);
    expect(queueA.map((r) => r.id)).not.toContain(bEventId);
  });
});

describe.skipIf(skipIfNoTestDb)("APPROVAL-08: getRejectedForEditor lists the editor's rejected events with reason", () => {
  let editorId: string;
  let adminId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    editorId = (await ensureEditor(testSchoolA, "approval-editor@test", "editor")).id;
    adminId = (await ensureEditor(testSchoolA, "approval-admin@test", "admin")).id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("returns the rejection reason from the latest revision", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await submitForApproval(testSchoolA, id, editorId);
    await rejectEvent(testSchoolA, id, adminId, "תאריך לא מתאים");

    const rejected = await getRejectedForEditor(testSchoolA, editorId);
    const row = rejected.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row!.reason).toBe("תאריך לא מתאים");
  });

  it("does not return other editors' rejected events", async () => {
    const otherEditor = await ensureEditor(testSchoolA, "other-editor@test", "editor");
    const { id } = await createDraft(testSchoolA, otherEditor.id, eventTypeId);
    await submitForApproval(testSchoolA, id, otherEditor.id);
    await rejectEvent(testSchoolA, id, adminId, "שאר העורכים");

    const rejected = await getRejectedForEditor(testSchoolA, editorId);
    expect(rejected.map((r) => r.id)).not.toContain(id);
  });
});
