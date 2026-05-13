import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { getEditorDashboardEvents } from "@/lib/events/queries";

/**
 * Staff dashboard — Server Component.
 * Shows the editor's draft and pending events (WIZARD-03, WIZARD-07).
 * Rejected events live on /dashboard/rejected.
 */
export default async function DashboardPage() {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const myEvents = await getEditorDashboardEvents(user.schoolId, user.id);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/rejected"
            className="text-sm text-blue-600 hover:underline"
          >
            {t("rejected.linkLabel")}
          </Link>
          <Link
            href="/events/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {t("newEvent")}
          </Link>
        </div>
      </div>
      {myEvents.length === 0 ? (
        <p className="text-neutral-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
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
                {event.status === "draft" && (
                  <Link
                    href={`/events/new?resumeId=${event.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t("resume")}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    draft: "bg-neutral-100 text-neutral-700",
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-700"}`}
    >
      {label}
    </span>
  );
}
