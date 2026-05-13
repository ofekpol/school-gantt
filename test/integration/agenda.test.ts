import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  approveEvent,
  autoApproveAsAdmin,
} from "@/lib/events/approval";
import { createDraft, updateDraft } from "@/lib/events/crud";
import { getAgendaForSchool, groupByWeek } from "@/lib/views/agenda";
import { getSchoolBySlug } from "@/lib/db/schools";
import { submitForApproval } from "@/lib/events/approval";
import { testDb, skipIfNoTestDb, testSchoolA, testSchoolB } from "./setup";

/**
 * Phase 4 — public agenda integration tests.
 * The agenda projection must return only approved, non-deleted events for the
 * school, with filtering by grade / event-type / free-text search, and must
 * be safe to call without an authenticated user (uses withSchool only).
 */

async function ensureStaff(
  schoolId: string,
  email: string,
  role: "editor" | "admin",
) {
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

async function eventTypeFor(schoolId: string): Promise<{ id: string; key: string }> {
  const [t] = await testDb!
    .select({ id: schema.eventTypes.id, key: schema.eventTypes.key })
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, schoolId))
    .limit(1);
  return t;
}

async function makeApprovedEvent(opts: {
  schoolId: string;
  editorId: string;
  adminId: string;
  eventTypeId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  grades: number[];
}) {
  const { id } = await createDraft(opts.schoolId, opts.editorId, opts.eventTypeId);
  await updateDraft(
    opts.schoolId,
    id,
    opts.editorId,
    false,
    {
      title: opts.title,
      startAt: opts.startAt.toISOString(),
      endAt: opts.endAt.toISOString(),
      grades: opts.grades,
    },
    null,
  );
  await submitForApproval(opts.schoolId, id, opts.editorId);
  await approveEvent(opts.schoolId, id, opts.adminId);
  return id;
}

describe.skipIf(skipIfNoTestDb)("AGENDA-01: getSchoolBySlug resolves test schools", () => {
  it("returns the row for 'test-a'", async () => {
    const row = await getSchoolBySlug("test-a");
    expect(row?.id).toBe(testSchoolA);
  });

  it("returns null for an unknown slug", async () => {
    const row = await getSchoolBySlug("does-not-exist-zzz");
    expect(row).toBeNull();
  });
});

describe.skipIf(skipIfNoTestDb)("AGENDA-02: only approved, non-deleted events appear", () => {
  let editorId: string;
  let adminId: string;
  let typeId: string;

  beforeAll(async () => {
    editorId = (await ensureStaff(testSchoolA, "agenda-editor@test", "editor")).id;
    adminId = (await ensureStaff(testSchoolA, "agenda-admin@test", "admin")).id;
    typeId = (await eventTypeFor(testSchoolA)).id;
  });

  it("hides drafts and pending events; surfaces approved ones", async () => {
    const approvedId = await makeApprovedEvent({
      schoolId: testSchoolA,
      editorId,
      adminId,
      eventTypeId: typeId,
      title: "AGENDA approved event",
      startAt: new Date("2026-05-20T08:00:00+03:00"),
      endAt: new Date("2026-05-20T10:00:00+03:00"),
      grades: [10],
    });
    const { id: draftId } = await createDraft(testSchoolA, editorId, typeId);
    await updateDraft(
      testSchoolA,
      draftId,
      editorId,
      false,
      { title: "AGENDA draft (hidden)" },
      null,
    );
    const { id: pendingId } = await createDraft(testSchoolA, editorId, typeId);
    await updateDraft(
      testSchoolA,
      pendingId,
      editorId,
      false,
      { title: "AGENDA pending (hidden)" },
      null,
    );
    await submitForApproval(testSchoolA, pendingId, editorId);

    const rows = await getAgendaForSchool(testSchoolA, {});
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(approvedId);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(pendingId);
  });

  it("hides soft-deleted approved events (parent_event_id swap on revision approval)", async () => {
    const v1Id = await makeApprovedEvent({
      schoolId: testSchoolA,
      editorId,
      adminId,
      eventTypeId: typeId,
      title: "AGENDA v1",
      startAt: new Date("2026-05-21T08:00:00+03:00"),
      endAt: new Date("2026-05-21T10:00:00+03:00"),
      grades: [10],
    });
    // Soft-delete it directly to simulate post-revision state
    await testDb!
      .update(schema.events)
      .set({ deletedAt: new Date() })
      .where(eq(schema.events.id, v1Id));

    const rows = await getAgendaForSchool(testSchoolA, {});
    expect(rows.map((r) => r.id)).not.toContain(v1Id);
  });
});

describe.skipIf(skipIfNoTestDb)("AGENDA-03: filter by grade", () => {
  let editorId: string;
  let adminId: string;
  let typeId: string;
  let g10Id: string;
  let g11Id: string;

  beforeAll(async () => {
    editorId = (await ensureStaff(testSchoolA, "agenda-editor@test", "editor")).id;
    adminId = (await ensureStaff(testSchoolA, "agenda-admin@test", "admin")).id;
    typeId = (await eventTypeFor(testSchoolA)).id;
    g10Id = await makeApprovedEvent({
      schoolId: testSchoolA,
      editorId,
      adminId,
      eventTypeId: typeId,
      title: "AGENDA grade 10",
      startAt: new Date("2026-05-22T08:00:00+03:00"),
      endAt: new Date("2026-05-22T10:00:00+03:00"),
      grades: [10],
    });
    g11Id = await makeApprovedEvent({
      schoolId: testSchoolA,
      editorId,
      adminId,
      eventTypeId: typeId,
      title: "AGENDA grade 11",
      startAt: new Date("2026-05-23T08:00:00+03:00"),
      endAt: new Date("2026-05-23T10:00:00+03:00"),
      grades: [11],
    });
  });

  it("?grades=10 returns only events touching grade 10", async () => {
    const rows = await getAgendaForSchool(testSchoolA, { grades: [10] });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(g10Id);
    expect(ids).not.toContain(g11Id);
  });

  it("multi-grade event matches when any grade overlaps the filter", async () => {
    const multiId = await makeApprovedEvent({
      schoolId: testSchoolA,
      editorId,
      adminId,
      eventTypeId: typeId,
      title: "AGENDA multi 10+11",
      startAt: new Date("2026-05-24T08:00:00+03:00"),
      endAt: new Date("2026-05-24T10:00:00+03:00"),
      grades: [10, 11],
    });
    const rows10 = await getAgendaForSchool(testSchoolA, { grades: [10] });
    const rows11 = await getAgendaForSchool(testSchoolA, { grades: [11] });
    expect(rows10.map((r) => r.id)).toContain(multiId);
    expect(rows11.map((r) => r.id)).toContain(multiId);
  });
});

describe.skipIf(skipIfNoTestDb)("AGENDA-04: filter by event type and search", () => {
  let adminId: string;
  let typeId: string;
  let typeKey: string;

  beforeAll(async () => {
    adminId = (await ensureStaff(testSchoolA, "agenda-admin@test", "admin")).id;
    const t = await eventTypeFor(testSchoolA);
    typeId = t.id;
    typeKey = t.key;
  });

  it("?types=<key> filters to that event type only", async () => {
    const { id: keepId } = await createDraft(testSchoolA, adminId, typeId);
    await updateDraft(
      testSchoolA,
      keepId,
      adminId,
      true,
      {
        title: "AGENDA typed match",
        startAt: new Date("2026-05-25T08:00:00+03:00").toISOString(),
        endAt: new Date("2026-05-25T09:00:00+03:00").toISOString(),
        grades: [10],
      },
      null,
    );
    await autoApproveAsAdmin(testSchoolA, keepId, adminId);

    const rows = await getAgendaForSchool(testSchoolA, { types: [typeKey] });
    expect(rows.map((r) => r.id)).toContain(keepId);
  });

  it("?q=<text> matches case-insensitively within title", async () => {
    const { id } = await createDraft(testSchoolA, adminId, typeId);
    await updateDraft(
      testSchoolA,
      id,
      adminId,
      true,
      {
        title: "טיול לכנרת 2026",
        startAt: new Date("2026-05-26T08:00:00+03:00").toISOString(),
        endAt: new Date("2026-05-26T16:00:00+03:00").toISOString(),
        grades: [10],
      },
      null,
    );
    await autoApproveAsAdmin(testSchoolA, id, adminId);

    const hits = await getAgendaForSchool(testSchoolA, { q: "כנרת" });
    expect(hits.map((r) => r.id)).toContain(id);

    const misses = await getAgendaForSchool(testSchoolA, { q: "no-such-word-xyz" });
    expect(misses.map((r) => r.id)).not.toContain(id);
  });
});

describe.skipIf(skipIfNoTestDb)("AGENDA-05: cross-school isolation", () => {
  it("school B's approved events do not leak into school A's agenda", async () => {
    const editor = await ensureStaff(testSchoolB, "agenda-editor-b@test", "editor");
    const admin = await ensureStaff(testSchoolB, "agenda-admin-b@test", "admin");
    const type = await eventTypeFor(testSchoolB);
    const id = await makeApprovedEvent({
      schoolId: testSchoolB,
      editorId: editor.id,
      adminId: admin.id,
      eventTypeId: type.id,
      title: "AGENDA school-B-only",
      startAt: new Date("2026-05-27T08:00:00+03:00"),
      endAt: new Date("2026-05-27T09:00:00+03:00"),
      grades: [10],
    });
    const rowsA = await getAgendaForSchool(testSchoolA, {});
    expect(rowsA.map((r) => r.id)).not.toContain(id);
  });
});

describe("AGENDA-06: groupByWeek (Sunday-start, Asia/Jerusalem)", () => {
  it("groups events that fall in the same Sunday-to-Saturday window", () => {
    // 2026-05-17 (Sun) through 2026-05-23 (Sat) is one week.
    const events = [
      mkRow("a", "2026-05-17T08:00:00+03:00"),
      mkRow("b", "2026-05-20T08:00:00+03:00"),
      mkRow("c", "2026-05-23T22:00:00+03:00"),
      mkRow("d", "2026-05-24T08:00:00+03:00"), // next week (Sunday again)
    ];
    const weeks = groupByWeek(events);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].items.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(weeks[1].items.map((e) => e.id)).toEqual(["d"]);
  });
});

function mkRow(id: string, iso: string) {
  return {
    id,
    title: id,
    startAt: new Date(iso),
    endAt: new Date(iso),
    allDay: false,
    description: null,
    location: null,
    eventTypeKey: "trip",
    eventTypeLabelHe: "טיול",
    eventTypeColor: "#ff0000",
    eventTypeGlyph: "T",
    grades: [10],
  };
}
