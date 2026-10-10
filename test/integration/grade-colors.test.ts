import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { getGradeColors, setGradeColors } from "@/lib/db/grade-colors";
import { DEFAULT_GRADE_COLORS } from "@/lib/grade-colors";
import { skipIfNoTestDb, testSchoolA, testSchoolB } from "./setup";

async function clearColors(schoolId: string): Promise<void> {
  await withSchool(schoolId, (tx) =>
    tx.delete(schema.schoolGradeColors).where(eq(schema.schoolGradeColors.schoolId, schoolId)),
  );
}

describe.skipIf(skipIfNoTestDb)("school_grade_colors RLS", () => {
  afterAll(async () => {
    await clearColors(testSchoolA);
    await clearColors(testSchoolB);
  });

  it("stores and reads a school's own grade colors", async () => {
    const colors = await setGradeColors(testSchoolA, [{ grade: 7, colorHex: "#DDF5D0" }]);
    expect(colors[7]).toBe("#DDF5D0");
    expect(colors[8]).toBe(DEFAULT_GRADE_COLORS[8]);

    const updated = await setGradeColors(testSchoolA, [{ grade: 7, colorHex: "#FFF2C2" }]);
    expect(updated[7]).toBe("#FFF2C2");
  });

  it("does not leak another school's colors", async () => {
    await setGradeColors(testSchoolA, [{ grade: 9, colorHex: "#DCE3EC" }]);
    const rows = await withSchool(testSchoolB, (tx) =>
      tx
        .select()
        .from(schema.schoolGradeColors)
        .where(eq(schema.schoolGradeColors.schoolId, testSchoolA)),
    );
    expect(rows).toHaveLength(0);
    expect((await getGradeColors(testSchoolB))[9]).toBe(DEFAULT_GRADE_COLORS[9]);
  });

  it("rejects writing a row for another school", async () => {
    await expect(
      withSchool(testSchoolB, (tx) =>
        tx.insert(schema.schoolGradeColors).values({
          schoolId: testSchoolA,
          grade: 10,
          colorHex: "#CFE3FA",
        }),
      ),
    ).rejects.toThrow();
  });
});
