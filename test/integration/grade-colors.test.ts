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
    const colors = await setGradeColors(testSchoolA, [{ grade: 7, colorHex: "#7A7A2E" }]);
    expect(colors[7]).toBe("#7A7A2E");
    expect(colors[8]).toBe(DEFAULT_GRADE_COLORS[8]);

    const updated = await setGradeColors(testSchoolA, [{ grade: 7, colorHex: "#3D7D8F" }]);
    expect(updated[7]).toBe("#3D7D8F");
  });

  it("does not leak another school's colors", async () => {
    await setGradeColors(testSchoolA, [{ grade: 9, colorHex: "#8C6D46" }]);
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
          colorHex: "#0F6FB0",
        }),
      ),
    ).rejects.toThrow();
  });
});
