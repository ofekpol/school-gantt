import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import { withSchool } from "@/lib/db/client";
import {
  academicYears,
  editorScopes,
  eventTypes,
  events,
  schools,
} from "@/lib/db/schema";
import { WizardShell } from "@/components/wizard/WizardShell";

interface PageProps {
  searchParams: Promise<{ resumeId?: string }>;
}

/**
 * New Event page — Server Component.
 * Loads initial data (academic year bounds, event types, grade scopes)
 * and passes it as props to the WizardShell Client Component.
 * Supports resuming a draft via ?resumeId= query param (WIZARD-03).
 */
export default async function NewEventPage({ searchParams }: PageProps) {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const { resumeId } = await searchParams;

  // Fetch active academic year bounds for date picker constraint (WIZARD-04)
  const [school] = await withSchool(user.schoolId, (tx) =>
    tx
      .select({ activeAcademicYearId: schools.activeAcademicYearId })
      .from(schools)
      .where(eq(schools.id, user.schoolId))
      .limit(1),
  );

  let yearBounds: { startDate: string; endDate: string } | null = null;
  if (school?.activeAcademicYearId) {
    const [year] = await withSchool(user.schoolId, (tx) =>
      tx
        .select({
          startDate: academicYears.startDate,
          endDate: academicYears.endDate,
        })
        .from(academicYears)
        .where(eq(academicYears.id, school.activeAcademicYearId!))
        .limit(1),
    );
    if (year) yearBounds = { startDate: year.startDate, endDate: year.endDate };
  }

  // Fetch school's event type palette for Step 3
  const eventTypeList = await withSchool(user.schoolId, (tx) =>
    tx
      .select({
        id: eventTypes.id,
        key: eventTypes.key,
        labelHe: eventTypes.labelHe,
        colorHex: eventTypes.colorHex,
        glyph: eventTypes.glyph,
      })
      .from(eventTypes)
      .where(eq(eventTypes.schoolId, user.schoolId))
      .orderBy(eventTypes.sortOrder),
  );

  // Determine allowed grades based on editor scopes (WIZARD-05)
  let allowedGrades: number[] = [7, 8, 9, 10, 11, 12];
  if (user.role === "editor") {
    const scopes = await withSchool(user.schoolId, (tx) =>
      tx
        .select({ scopeValue: editorScopes.scopeValue })
        .from(editorScopes)
        .where(
          and(
            eq(editorScopes.staffUserId, user.id),
            eq(editorScopes.scopeKind, "grade"),
          ),
        ),
    );
    if (scopes.length > 0) {
      allowedGrades = scopes.map((s) => parseInt(s.scopeValue, 10));
    }
  }

  // Resume existing draft if resumeId provided (WIZARD-03)
  let resumeDraft: Record<string, unknown> | null = null;
  if (resumeId) {
    const [draft] = await withSchool(user.schoolId, (tx) =>
      tx
        .select()
        .from(events)
        .where(
          and(
            eq(events.id, resumeId),
            eq(events.createdBy, user.id),
            isNull(events.deletedAt),
          ),
        )
        .limit(1),
    );
    if (draft) resumeDraft = draft as Record<string, unknown>;
  }

  return (
    <WizardShell
      yearBounds={yearBounds}
      eventTypes={eventTypeList}
      allowedGrades={allowedGrades}
      resumeDraft={resumeDraft}
      resumeId={resumeId ?? null}
    />
  );
}
