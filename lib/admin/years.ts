import "server-only";
import { eq, desc } from "drizzle-orm";
import { db, withSchool } from "@/lib/db/client";
import { academicYears, schools } from "@/lib/db/schema";
import type { z } from "zod";
import type { AcademicYearSchema } from "@/lib/validations/admin";

type AcademicYearInput = z.infer<typeof AcademicYearSchema>;

/**
 * Sets schools.active_academic_year_id = yearId.
 * schools table has no RLS (it is the tenant root) — use `db` directly, NOT withSchool.
 * Researched: 02-RESEARCH.md Open Q 2.
 */
export async function setActiveYear(schoolId: string, yearId: string): Promise<void> {
  await db
    .update(schools)
    .set({ activeAcademicYearId: yearId })
    .where(eq(schools.id, schoolId));
}

export async function createAcademicYear(
  schoolId: string,
  input: AcademicYearInput,
): Promise<{ id: string }> {
  const [row] = await withSchool(schoolId, (tx) =>
    tx
      .insert(academicYears)
      .values({
        schoolId,
        label: input.label,
        startDate: input.startDate,
        endDate: input.endDate,
      })
      .returning({ id: academicYears.id }),
  );
  if (input.setActive) {
    await setActiveYear(schoolId, row.id);
  }
  return { id: row.id };
}

export async function updateAcademicYear(
  schoolId: string,
  id: string,
  input: Partial<AcademicYearInput>,
): Promise<{ updated: boolean }> {
  const fieldUpdate = {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.startDate !== undefined && { startDate: input.startDate }),
    ...(input.endDate !== undefined && { endDate: input.endDate }),
  };

  // When only setActive is supplied (no other fields to update), skip the
  // UPDATE statement to avoid Drizzle's "No values to set" error and just
  // verify the row exists before activating it.
  if (Object.keys(fieldUpdate).length === 0) {
    if (!input.setActive) return { updated: false };
    const [row] = await withSchool(schoolId, (tx) =>
      tx
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(eq(academicYears.id, id))
        .limit(1),
    );
    if (!row) return { updated: false };
    await setActiveYear(schoolId, id);
    return { updated: true };
  }

  const rows = await withSchool(schoolId, (tx) =>
    tx
      .update(academicYears)
      .set(fieldUpdate)
      .where(eq(academicYears.id, id))
      .returning({ id: academicYears.id }),
  );
  if (rows.length > 0 && input.setActive) {
    await setActiveYear(schoolId, id);
  }
  return { updated: rows.length > 0 };
}

export async function listAcademicYears(schoolId: string) {
  return withSchool(schoolId, (tx) =>
    tx
      .select({
        id: academicYears.id,
        label: academicYears.label,
        startDate: academicYears.startDate,
        endDate: academicYears.endDate,
      })
      .from(academicYears)
      .orderBy(desc(academicYears.startDate)),
  );
}
