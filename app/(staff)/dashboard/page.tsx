import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import {
  getActiveAcademicYear,
  getEditorAllowedGrades,
  getEditorDashboardEvents,
  listEventTypes,
} from "@/lib/events/queries";
import { getSchoolById } from "@/lib/db/schools";
import { getAgendaForSchool } from "@/lib/views/agenda";
import type { AgendaItem } from "@/lib/views/agenda-model";
import { buildWeeklyModel, parseWeekParam } from "@/lib/views/gantt-weekly";
import { buildCalendarModel } from "@/lib/views/calendar";
import { getDashboardGradeSelection } from "@/lib/dashboard/grade-filter";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

interface PageProps {
  searchParams: Promise<{
    view?: string;
    week?: string;
    month?: string;
    grades?: string | string[];
  }>;
}

/**
 * Staff/admin dashboard — school-wide weekly/monthly calendar.
 * Clicking a day opens the quick event popup with that date selected.
 * Personal drafts live under a collapsible "My drafts" section.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await getStaffUser();
  if (!user) redirect("/");
  if (!user.schoolId) redirect("/auth/pending");

  const sp = await searchParams;
  const view = sp.view === "monthly" ? "monthly" : "weekly";

  const [school, activeYear, myEvents, eventTypeList, allowedGrades] = await Promise.all([
    getSchoolById(user.schoolId),
    getActiveAcademicYear(user.schoolId),
    getEditorDashboardEvents(user.schoolId, user.id),
    listEventTypes(user.schoolId),
    user.role === "editor"
      ? getEditorAllowedGrades(user.schoolId, user.id)
      : Promise.resolve(ALL_GRADES),
  ]);
  const gradeSelection = getDashboardGradeSelection(allowedGrades, sp.grades);
  const agendaItems = await getAgendaForSchool(user.schoolId, {
    grades: gradeSelection.dataGrades,
    dismissedByStaffId: user.id,
  });

  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");

  const editableEventIds = new Set(myEvents.map((event) => event.id));
  const serializedEvents = agendaItems.map((e) => ({
    id: e.id,
    title: e.title,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    allDay: e.allDay,
    description: e.description,
    location: e.location,
    eventTypeId: e.eventTypeId ?? "",
    eventTypeKey: e.eventTypeKey,
    eventTypeLabelHe: e.eventTypeLabelHe,
    eventTypeColor: e.eventTypeColor,
    eventTypeGlyph: e.eventTypeGlyph,
    grades: e.grades,
    status: e.status ?? "approved",
    isCanceled: e.isCanceled === true,
    isUpdated: e.isUpdated === true,
    canEdit: e.isCanceled !== true && (user.role === "admin" || editableEventIds.has(e.id)),
  }));

  const weeklyModel = buildWeeklyModel(
    parseWeekParam(sp.week),
    agendaItems,
    gradeSelection.selectedGrades,
    new Date(),
  );

  const months =
    activeYear
      ? buildCalendarModel({
          year: {
            startDate: activeYear.startDate,
            endDate: activeYear.endDate,
          },
          events: agendaItems.map(toCalendarInput),
        }).months
      : undefined;

  return (
    <main className="pb-12">
      <div className="flex items-center justify-between px-6 pt-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {school && (
        <DashboardCalendar
          view={view}
          weeklyModel={weeklyModel}
          months={months}
          events={serializedEvents}
          yearLabel={activeYear?.label ?? ""}
          schoolName={school.name}
          yearBounds={
            activeYear ? { startDate: activeYear.startDate, endDate: activeYear.endDate } : null
          }
          eventTypes={eventTypeList}
          allowedGrades={allowedGrades}
          selectedGrades={gradeSelection.selectedGrades}
          canCreateEvents={user.role !== "viewer"}
        />
      )}

      <section className="mt-10 px-6">
        <details>
          <summary className="mb-3 cursor-pointer text-base font-semibold">
            {t("myDrafts")} ({myEvents.length})
          </summary>
          {myEvents.length === 0 ? (
            <p className="mt-3 text-neutral-500">{t("empty")}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {myEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 p-4"
                >
                  <div>
                    <p className="font-medium">{event.title || tc("unnamed")}</p>
                    <p className="text-sm text-neutral-500">
                      {event.startAt
                        ? new Intl.DateTimeFormat("he-IL", {
                            timeZone: "Asia/Jerusalem",
                          }).format(new Date(event.startAt))
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={event.status}
                      label={t(`status.${event.status}` as `status.${typeof event.status}`)}
                    />
                    {(event.status === "draft" || event.status === "approved") && (
                      <Link
                        href={`/events/new?resumeId=${event.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {event.status === "draft" ? t("resume") : t("edit")}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>
    </main>
  );
}

function toCalendarInput(e: AgendaItem) {
  return {
    id: e.id,
    title: e.title,
    startAt: e.startAt,
    endAt: e.endAt,
    allDay: e.allDay,
    grades: e.grades,
    eventTypeKey: e.eventTypeKey,
    eventTypeLabelHe: e.eventTypeLabelHe,
    eventTypeColor: e.eventTypeColor,
    eventTypeGlyph: e.eventTypeGlyph,
    status: e.status ?? "approved",
    isCanceled: e.isCanceled === true,
    isUpdated: e.isUpdated === true,
  };
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    draft: "bg-neutral-100 text-neutral-700",
    approved: "bg-green-100 text-green-800",
    canceled: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-700"}`}
    >
      {label}
    </span>
  );
}
