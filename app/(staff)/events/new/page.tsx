import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import {
  getActiveAcademicYear,
  getDraftForResume,
  getEditorAllowedGrades,
  listEventTypes,
} from "@/lib/events/queries";
import { WizardShell } from "@/components/wizard/WizardShell";

interface PageProps {
  searchParams: Promise<{ resumeId?: string }>;
}

/**
 * New Event page — Server Component.
 * Consumes lib/events/queries.ts exclusively (no direct withSchool or schema imports).
 * Supports resuming a draft via ?resumeId= (WIZARD-03).
 */
export default async function NewEventPage({ searchParams }: PageProps) {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const { resumeId } = await searchParams;

  const [activeYear, eventTypeList, allowedGradesRaw] = await Promise.all([
    getActiveAcademicYear(user.schoolId),
    listEventTypes(user.schoolId),
    user.role === "editor"
      ? getEditorAllowedGrades(user.schoolId, user.id)
      : Promise.resolve([7, 8, 9, 10, 11, 12] as number[]),
  ]);

  const yearBounds = activeYear
    ? { startDate: activeYear.startDate, endDate: activeYear.endDate }
    : null;

  const allowedGrades = allowedGradesRaw;

  const resumeDraft = resumeId
    ? await getDraftForResume(user.schoolId, resumeId, user.id)
    : null;

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
