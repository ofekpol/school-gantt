import "server-only";
import { eq } from "drizzle-orm";
import { db, withSchool } from "@/lib/db/client";
import { academicYears, schools } from "@/lib/db/schema";

/**
 * Returns the active academic year for a school, or null if none is set.
 * Reads schools.active_academic_year_id (no RLS on schools), then fetches the year row.
 */
export async function getActiveAcademicYear(
  schoolId: string,
): Promise<{ id: string; label: string; startDate: string; endDate: string } | null> {
  const [school] = await db
    .select({ activeAcademicYearId: schools.activeAcademicYearId })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);

  if (!school?.activeAcademicYearId) return null;

  const yearId = school.activeAcademicYearId;
  const [year] = await withSchool(schoolId, (tx) =>
    tx
      .select({
        id: academicYears.id,
        label: academicYears.label,
        startDate: academicYears.startDate,
        endDate: academicYears.endDate,
      })
      .from(academicYears)
      .where(eq(academicYears.id, yearId))
      .limit(1),
  );

  return year ?? null;
}
