import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { getRejectedForEditor } from "@/lib/events/revisions";

/**
 * Editor's rejected events — Server Component.
 * PRD §6.3: "Rejected events return to the editor with the reason attached;
 * the editor can revise and resubmit."
 *
 * Reads the rejection reason from the latest `rejected` revision row.
 * Clicking "edit & resubmit" sends the editor back into the wizard, which
 * re-uses the existing event row (status moves rejected → pending on submit).
 */
export default async function RejectedEventsPage() {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const items = await getRejectedForEditor(user.schoolId, user.id);
  const t = await getTranslations("dashboard.rejected");
  const tc = await getTranslations("common");

  const dateFmt = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "medium",
  });
  const dateTimeFmt = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      {items.length === 0 ? (
        <p className="text-neutral-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-neutral-200 p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1">
                <p className="font-medium">{item.title || tc("unnamed")}</p>
                <p className="text-sm text-neutral-500">
                  {dateFmt.format(new Date(item.startAt))}
                </p>
                <div className="mt-2 rounded bg-red-50 p-3 text-sm">
                  <p className="font-medium text-red-900">{t("reason")}</p>
                  <p className="text-red-800 whitespace-pre-wrap">
                    {item.reason || "—"}
                  </p>
                  <p className="mt-1 text-xs text-red-700">
                    {t("decidedAt")}: {dateTimeFmt.format(new Date(item.decidedAt))}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Link
                  href={`/events/new?resumeId=${item.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t("resubmit")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
