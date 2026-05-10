import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { skipIfNoTestDb, testSchoolA, testSchoolB } from "./setup";

describe.skipIf(skipIfNoTestDb)("DB-02 + DB-03: withSchool sets RLS session var", () => {
  it("queries inside withSchool(schoolA) see only schoolA rows", async () => {
    const rows = await withSchool(testSchoolA, (tx) =>
      tx.select().from(schema.eventTypes),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.schoolId).toBe(testSchoolA);
  });

  it("queries inside withSchool(schoolB) see only schoolB rows", async () => {
    const rows = await withSchool(testSchoolB, (tx) =>
      tx.select().from(schema.eventTypes),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.schoolId).toBe(testSchoolB);
  });
});

describe.skipIf(skipIfNoTestDb)("DB-05: cross-school access returns empty (404 surface)", () => {
  it("withSchool(schoolA) cannot read schoolB rows even with explicit schoolId in WHERE", async () => {
    const rows = await withSchool(testSchoolA, (tx) =>
      tx
        .select()
        .from(schema.eventTypes)
        .where(eq(schema.eventTypes.schoolId, testSchoolB)),
    );
    expect(rows).toHaveLength(0);
  });
});
