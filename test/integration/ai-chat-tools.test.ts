import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createPublishedEvent } from "@/lib/events/crud";
import { countSchoolEvents, getSchoolInfo, searchSchoolEvents } from "@/lib/ai/chat/tools";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

const PREFIX = "AICHAT ";

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

async function typeOf(schoolId: string): Promise<{ id: string; key: string }> {
  const [t] = await testDb!
    .select({ id: schema.eventTypes.id, key: schema.eventTypes.key })
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, schoolId))
    .limit(1);
  return t;
}

const RANGE = { fromDate: "2032-01-01", toDate: "2032-01-31" };

describe.skipIf(skipIfNoTestDb)("AI-CHAT-TOOLS: school-bound read-only tools", () => {
  let typeKeyA: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    await testDb!.delete(schema.events).where(like(schema.events.title, `${PREFIX}%`));
    const staffA = await ensureStaff(testSchoolA, "ai-chat-a@test");
    const staffB = await ensureStaff(testSchoolB, "ai-chat-b@test");
    const typeA = await typeOf(testSchoolA);
    const typeB = await typeOf(testSchoolB);
    typeKeyA = typeA.key;
    const add = (school: string, staff: string, type: string, title: string, day: string, grades: number[]) =>
      createPublishedEvent(school, staff, {
        title: `${PREFIX}${title}`,
        startAt: `2032-01-${day}T10:00:00+02:00`,
        endAt: `2032-01-${day}T11:00:00+02:00`,
        eventTypeId: type,
        grades,
      });
    await add(testSchoolA, staffA, typeA.id, "טיול ח", "05", [8]);
    await add(testSchoolA, staffA, typeA.id, "מבחן ט", "06", [9]);
    const deleted = await add(testSchoolA, staffA, typeA.id, "נמחק", "07", [8]);
    await testDb!.update(schema.events).set({ deletedAt: new Date() }).where(eq(schema.events.id, deleted.id));
    await add(testSchoolB, staffB, typeB.id, "של בית ספר אחר", "05", [8]);
  });

  it("searchSchoolEvents returns only the bound school's events", async () => {
    if (shouldSkip()) return;
    const res = await searchSchoolEvents(testSchoolA, { ...RANGE });
    const titles = res.events.map((e) => e.title).filter((t) => t.startsWith(PREFIX));
    expect(titles.sort()).toEqual([`${PREFIX}טיול ח`, `${PREFIX}מבחן ט`].sort());
  });

  it("filters by grade and formats dates for Jerusalem", async () => {
    if (shouldSkip()) return;
    const res = await searchSchoolEvents(testSchoolA, { ...RANGE, grades: [9] });
    const mine = res.events.filter((e) => e.title.startsWith(PREFIX));
    expect(mine).toEqual([
      expect.objectContaining({ title: `${PREFIX}מבחן ט`, start: "06/01/2032 10:00", end: "06/01/2032 11:00", grades: ["ט"] }),
    ]);
  });

  it("filters by free-text query", async () => {
    if (shouldSkip()) return;
    const res = await searchSchoolEvents(testSchoolA, { ...RANGE, query: "טיול" });
    expect(res.events.filter((e) => e.title.startsWith(PREFIX)).map((e) => e.title)).toEqual([`${PREFIX}טיול ח`]);
  });

  it("rejects ranges longer than 400 days", async () => {
    if (shouldSkip()) return;
    const res = await searchSchoolEvents(testSchoolA, { fromDate: "2030-01-01", toDate: "2032-01-01" });
    expect(res).toEqual({ events: [], error: "range_too_long" });
  });

  it("countSchoolEvents groups by grade within the school only", async () => {
    if (shouldSkip()) return;
    const res = await countSchoolEvents(testSchoolA, { ...RANGE, groupBy: "grade" });
    const byKey = Object.fromEntries(res.counts.map((c) => [c.key, c.count]));
    expect(byKey["ח"]).toBeGreaterThanOrEqual(1);
    expect(byKey["ט"]).toBeGreaterThanOrEqual(1);
    const other = await countSchoolEvents(testSchoolB, { ...RANGE, groupBy: "type" });
    expect(other.counts.reduce((n, c) => n + c.count, 0)).toBeGreaterThanOrEqual(1);
    expect(typeKeyA).toBeTruthy();
  });

  it("getSchoolInfo returns the bound school's name", async () => {
    if (shouldSkip()) return;
    const [school] = await testDb!.select().from(schema.schools).where(eq(schema.schools.id, testSchoolA));
    const info = await getSchoolInfo(testSchoolA);
    expect(info.name).toBe(school.name);
  });
});
