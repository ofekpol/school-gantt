import { and, eq, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import { withSchool } from "@/lib/db/client";
import { events } from "@/lib/db/schema";

/**
 * Staff dashboard — Server Component.
 * Shows editor's draft, pending, and rejected events (WIZARD-03, WIZARD-07).
 * Draft events have a "Continue" link to resume the wizard.
 */
export default async function DashboardPage() {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const myEvents = await withSchool(user.schoolId, (tx) =>
    tx
      .select({
        id: events.id,
        title: events.title,
        status: events.status,
        startAt: events.startAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .where(
        and(
          eq(events.createdBy, user.id),
          eq(events.schoolId, user.schoolId),
          isNull(events.deletedAt),
          inArray(events.status, ["draft", "pending", "rejected"]),
        ),
      )
      .orderBy(events.updatedAt),
  );

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">לוח בקרה</h1>
        <Link
          href="/events/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          אירוע חדש
        </Link>
      </div>
      {myEvents.length === 0 ? (
        <p className="text-neutral-500">
          אין אירועים עדיין. לחץ על &ldquo;אירוע חדש&rdquo; כדי להתחיל.
        </p>
      ) : (
        <ul className="space-y-3">
          {myEvents.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 p-4"
            >
              <div>
                <p className="font-medium">{event.title || "(ללא שם)"}</p>
                <p className="text-sm text-neutral-500">
                  {new Date(event.startAt).toLocaleDateString("he-IL")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={event.status} />
                {event.status === "draft" && (
                  <Link
                    href={`/events/new?resumeId=${event.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    המשך
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-neutral-100 text-neutral-700",
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    draft: "טיוטה",
    pending: "ממתין לאישור",
    approved: "מאושר",
    rejected: "נדחה",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-700"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
