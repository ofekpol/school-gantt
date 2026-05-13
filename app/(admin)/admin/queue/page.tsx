import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { listPendingForQueue } from "@/lib/events/revisions";
import { QueueTable } from "@/components/admin/QueueTable";

/**
 * Admin approval queue — Server Component.
 * Lists pending events sorted by submission time (PRD §6.3).
 * Approve/reject mutations are issued by the client QueueTable.
 */
export default async function AdminQueuePage() {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const items = await listPendingForQueue(user.schoolId);
  const t = await getTranslations("admin.queue");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <QueueTable initial={items} />
    </main>
  );
}
