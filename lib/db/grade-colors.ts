import "server-only";
import { asc, sql } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { schoolGradeColors } from "@/lib/db/schema";
import { resolveGradeColors, type GradeColorMap } from "@/lib/grade-colors";

export interface GradeColorRow {
  grade: number;
  colorHex: string;
}

/** Returns the school's grade colors with defaults filled in for unset grades. */
export async function getGradeColors(schoolId: string): Promise<GradeColorMap> {
  const rows = await withSchool(schoolId, (tx) =>
    tx
      .select({ grade: schoolGradeColors.grade, colorHex: schoolGradeColors.colorHex })
      .from(schoolGradeColors)
      .orderBy(asc(schoolGradeColors.grade)),
  );
  return resolveGradeColors(rows);
}

/** Upserts the given grade colors for the school. Other grades are left unchanged. */
export async function setGradeColors(
  schoolId: string,
  colors: readonly GradeColorRow[],
): Promise<GradeColorMap> {
  if (colors.length > 0) {
    await withSchool(schoolId, (tx) =>
      tx
        .insert(schoolGradeColors)
        .values(colors.map((row) => ({ schoolId, grade: row.grade, colorHex: row.colorHex })))
        .onConflictDoUpdate({
          target: [schoolGradeColors.schoolId, schoolGradeColors.grade],
          set: { colorHex: sql`excluded.color_hex`, updatedAt: sql`now()` },
        }),
    );
  }
  return getGradeColors(schoolId);
}
