import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { publishEvent } from "@/lib/events/approval";
import { createDraft, updateDraft } from "@/lib/events/crud";
import { GET } from "@/app/api/v1/export/ics/route";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA } from "./setup";
import type { NextRequest } from "next/server";

/**
 * Phase — public `.ics` export route integration tests.
 * The route must return a valid VCALENDAR for a known school (no auth, no
 * token) and 404 for an unknown slug, reusing the agenda projection + iCal
 * serializer under RLS (withSchool).
 */

function req(query: string): NextRequest {
  return new Request(
    `http://localhost/api/v1/export/ics${query}`,
  ) as unknown as NextRequest;
}

async function ensureEditor(schoolId: string): Promise<string> {
  const email = "export-editor@test";
  const existing = await testDb!
    .select()
    .from(schema.staffUsers)
    .where(
      and(eq(schema.staffUsers.schoolId, schoolId), eq(schema.staffUsers.email, email)),
    )
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({ id: randomUUID(), schoolId, email, fullName: email, role: "editor" })
    .returning();
  return row.id;
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
  eventTypeId: string;
  title: string;
  grades: number[];
}): Promise<string> {
  const { id } = await createDraft(opts.schoolId, opts.editorId, opts.eventTypeId);
  await updateDraft(
    opts.schoolId,
    id,
    opts.editorId,
    false,
    {
      title: opts.title,
      startAt: new Date("2026-05-20T08:00:00+03:00").toISOString(),
      endAt: new Date("2026-05-20T10:00:00+03:00").toISOString(),
      grades: opts.grades,
    },
    null,
  );
  await publishEvent(opts.schoolId, id, opts.editorId);
  return id;
}

describe.skipIf(skipIfNoTestDb)("EXPORT-ICS-01: valid school", () => {
  beforeAll(async () => {
    if (shouldSkip()) return;
    const editorId = await ensureEditor(testSchoolA);
    const type = await eventTypeFor(testSchoolA);
    await makeApprovedEvent({
      schoolId: testSchoolA,
      editorId,
      eventTypeId: type.id,
      title: "EXPORT visible event",
      grades: [10],
    });
  });

  it("returns 200 with a valid VCALENDAR body and attachment headers", async () => {
    const res = await GET(req("?school=test-a"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("school-events.ics");

    const body = await res.text();
    expect(body.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(body).toContain("END:VCALENDAR");
    expect(body).toContain("EXPORT visible event");
  });

  it("grade filter narrows the event set", async () => {
    const all = await (await GET(req("?school=test-a"))).text();
    const g11Only = await (await GET(req("?school=test-a&grades=11"))).text();
    const countVevents = (s: string) => (s.match(/BEGIN:VEVENT/g) ?? []).length;
    // The grade-10 fixture is present unfiltered but excluded by grades=11.
    expect(all).toContain("EXPORT visible event");
    expect(g11Only).not.toContain("EXPORT visible event");
    expect(countVevents(g11Only)).toBeLessThanOrEqual(countVevents(all));
  });
});

describe.skipIf(skipIfNoTestDb)("EXPORT-ICS-02: unknown school", () => {
  it("returns 404 for an unknown slug", async () => {
    const res = await GET(req("?school=does-not-exist-zzz"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the school param is missing", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
  });
});
