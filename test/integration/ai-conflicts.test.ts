import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createPublishedEvent } from "@/lib/events/crud";
import { findConflicts } from "@/lib/ai/adder/conflicts";
import type { CandidateEvent } from "@/lib/ai/adder/types";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

const PREFIX = "AICONF ";

async function ensureStaff(schoolId: string, email: string): Promise<string> {
  const existing = await testDb!
    .select({ id: schema.staffUsers.id })
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.email, email))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({ id: randomUUID(), schoolId, email, fullName: email, role: "admin" })
    .returning({ id: schema.staffUsers.id });
  return row.id;
}

async function firstEventType(schoolId: string): Promise<string> {
  const [t] = await testDb!
    .select({ id: schema.eventTypes.id })
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, schoolId))
    .limit(1);
  return t.id;
}

function cand(overrides: Partial<CandidateEvent> = {}): CandidateEvent {
  return {
    clientId: randomUUID(),
    title: `${PREFIX}טיול שנתי`,
    startDate: "2031-03-12",
    endDate: null,
    dateHint: null,
    startTime: "10:00",
    endTime: "11:00",
    allDay: null,
    grades: [8],
    eventTypeId: null,
    location: "",
    description: "",
    warnings: [],
    ...overrides,
  };
}

describe.skipIf(skipIfNoTestDb)("AI-CONFLICTS: findConflicts", () => {
  let staffA: string;
  let staffB: string;
  let typeA: string;
  let typeB: string;

  async function publish(schoolId: string, staff: string, type: string, title: string, start: string, end: string, grades: number[]) {
    return createPublishedEvent(schoolId, staff, { title, startAt: start, endAt: end, eventTypeId: type, grades });
  }

  beforeAll(async () => {
    if (shouldSkip()) return;
    staffA = await ensureStaff(testSchoolA, "ai-conflicts-a@test");
    staffB = await ensureStaff(testSchoolB, "ai-conflicts-b@test");
    typeA = await firstEventType(testSchoolA);
    typeB = await firstEventType(testSchoolB);
  });

  beforeEach(async () => {
    if (shouldSkip()) return;
    await testDb!.delete(schema.events).where(like(schema.events.title, `${PREFIX}%`));
  });

  it("flags duplicate with same title and date", async () => {
    if (shouldSkip()) return;
    const e = await publish(testSchoolA, staffA, typeA, `${PREFIX}טיול שנתי`, "2031-03-12T08:00:00+02:00", "2031-03-12T16:00:00+02:00", [7]);
    const c = cand();
    const res = await findConflicts(testSchoolA, [c]);
    expect(res.get(c.clientId)).toEqual([
      { code: "duplicate", eventId: e.id, title: `${PREFIX}טיול שנתי`, date: "2031-03-12" },
    ]);
  });

  it("title match ignores spaces and case", async () => {
    if (shouldSkip()) return;
    await publish(testSchoolA, staffA, typeA, `${PREFIX}Trip  Day`, "2031-03-12T08:00:00+02:00", "2031-03-12T09:00:00+02:00", [7]);
    const c = cand({ title: ` ${PREFIX}trip day ` });
    const res = await findConflicts(testSchoolA, [c]);
    expect(res.get(c.clientId)?.map((w) => w.code)).toEqual(["duplicate"]);
  });

  it("flags overlap with a shared grade", async () => {
    if (shouldSkip()) return;
    const e = await publish(testSchoolA, staffA, typeA, `${PREFIX}מבחן באנגלית`, "2031-03-12T10:30:00+02:00", "2031-03-12T11:30:00+02:00", [8, 9]);
    const c = cand();
    const res = await findConflicts(testSchoolA, [c]);
    expect(res.get(c.clientId)).toEqual([
      {
        code: "overlap",
        eventId: e.id,
        title: `${PREFIX}מבחן באנגלית`,
        grades: [8, 9],
        startAt: new Date("2031-03-12T10:30:00+02:00").toISOString(),
        endAt: new Date("2031-03-12T11:30:00+02:00").toISOString(),
      },
    ]);
  });

  it("no overlap when grades differ", async () => {
    if (shouldSkip()) return;
    await publish(testSchoolA, staffA, typeA, `${PREFIX}אחר`, "2031-03-12T10:00:00+02:00", "2031-03-12T11:00:00+02:00", [10]);
    const c = cand();
    expect((await findConflicts(testSchoolA, [c])).get(c.clientId) ?? []).toEqual([]);
  });

  it("no overlap when times only touch", async () => {
    if (shouldSkip()) return;
    await publish(testSchoolA, staffA, typeA, `${PREFIX}אחר`, "2031-03-12T11:00:00+02:00", "2031-03-12T12:00:00+02:00", [8]);
    const c = cand();
    expect((await findConflicts(testSchoolA, [c])).get(c.clientId) ?? []).toEqual([]);
  });

  it("ignores soft-deleted events", async () => {
    if (shouldSkip()) return;
    const e = await publish(testSchoolA, staffA, typeA, `${PREFIX}טיול שנתי`, "2031-03-12T10:00:00+02:00", "2031-03-12T11:00:00+02:00", [8]);
    await testDb!.update(schema.events).set({ deletedAt: new Date() }).where(eq(schema.events.id, e.id));
    const c = cand();
    expect((await findConflicts(testSchoolA, [c])).get(c.clientId) ?? []).toEqual([]);
  });

  it("ignores another school's events", async () => {
    if (shouldSkip()) return;
    await publish(testSchoolB, staffB, typeB, `${PREFIX}טיול שנתי`, "2031-03-12T10:00:00+02:00", "2031-03-12T11:00:00+02:00", [8]);
    const c = cand();
    expect((await findConflicts(testSchoolA, [c])).get(c.clientId) ?? []).toEqual([]);
  });

  it("still flags a duplicate when the times are incomplete", async () => {
    if (shouldSkip()) return;
    await publish(testSchoolA, staffA, typeA, `${PREFIX}טיול שנתי`, "2031-03-12T10:00:00+02:00", "2031-03-12T11:00:00+02:00", [8]);
    const c = cand({ endTime: null });
    expect((await findConflicts(testSchoolA, [c])).get(c.clientId)?.map((w) => w.code)).toEqual(["duplicate"]);
  });

  it("skips candidates without a date", async () => {
    if (shouldSkip()) return;
    await publish(testSchoolA, staffA, typeA, `${PREFIX}טיול שנתי`, "2031-03-12T10:00:00+02:00", "2031-03-12T11:00:00+02:00", [8]);
    const c = cand({ startDate: null, dateHint: { day: 12, month: 3 } });
    expect((await findConflicts(testSchoolA, [c])).get(c.clientId) ?? []).toEqual([]);
  });
});
