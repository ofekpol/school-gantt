import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import {
  getActiveAcademicYear,
  getEditorDashboardEvents,
} from "@/lib/events/queries";
import { getSchoolById } from "@/lib/db/schools";
import { getAgendaForSchool, type AgendaItem } from "@/lib/views/agenda";
import {
  buildWeeklyModel,
  parseWeekParam,
} from "@/lib/views/gantt-weekly";
import { buildCalendarModel } from "@/lib/views/calendar";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

interface PageProps {
  searchParams: Promise<{
    view?: string;
    week?: string;
    month?: string;
  }>;
}

/**
 * Staff/admin dashboard — school-wide weekly/monthly calendar.
 * Clicking a day opens a confirm popup → /events/new?date=YYYY-MM-DD.
 * Personal drafts live under a collapsible "My drafts" section.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await getStaffUser();
  if (!user) redirect("/");
  if (!user.schoolId) redirect("/auth/pending");

  const sp = await searchParams;
  const view = sp.view === "monthly" ? "monthly" : "weekly";

  const [school, activeYear, agendaItems, myEvents] = await Promise.all([
    getSchoolById(user.schoolId),
    getActiveAcademicYear(user.schoolId),
    getAgendaForSchool(user.schoolId, {}),
    getEditorDashboardEvents(user.schoolId, user.id),
  ]);

  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");

  const serializedEvents = agendaItems.map((e) => ({
    id: e.id,
    title: e.title,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    allDay: e.allDay,
    description: e.description,
    location: e.location,
    eventTypeKey: e.eventTypeKey,
    eventTypeLabelHe: e.eventTypeLabelHe,
    eventTypeColor: e.eventTypeColor,
    eventTypeGlyph: e.eventTypeGlyph,
    grades: e.grades,
  }));

  const weeklyModel =
    view === "weekly"
      ? buildWeeklyModel(parseWeekParam(sp.week), agendaItems, ALL_GRADES, new Date())
      : undefined;

  const months =
    view === "monthly" && activeYear
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
      <div className="px-6 pt-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link
          href="/events/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {t("newEvent")}
        </Link>
      </div>

      {school && (
        <DashboardCalendar
          view={view}
          weeklyModel={weeklyModel}
          months={months}
          events={serializedEvents}
          yearLabel={activeYear?.label ?? ""}
          schoolName={school.name}
        />
      )}

      <section className="px-6 mt-10">
        <details>
          <summary className="cursor-pointer text-base font-semibold mb-3">
            {t("myDrafts")} ({myEvents.length})
          </summary>
          {myEvents.length === 0 ? (
            <p className="text-neutral-500 mt-3">{t("empty")}</p>
          ) : (
            <ul className="space-y-3 mt-3">
              {myEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 p-4"
                >
                  <div>
                    <p className="font-medium">
                      {event.title || tc("unnamed")}
                    </p>
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
                      label={t(
                        `status.${event.status}` as `status.${typeof event.status}`,
                      )}
                    />
                    {(event.status === "draft" ||
                      event.status === "approved") && (
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
  };
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    draft: "bg-neutral-100 text-neutral-700",
    approved: "bg-green-100 text-green-800",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-700"}`}
    >
      {label}
    </span>
  );
}
