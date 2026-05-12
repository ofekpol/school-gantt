import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { listEventTypes } from "@/lib/admin/event-types";
import { EventTypeTable } from "@/components/admin/EventTypeTable";

/**
 * Admin event-types management page — Server Component.
 * Lists all event types with create/edit/delete controls.
 * ADMIN-02 entry point.
 */
export default async function AdminEventTypesPage() {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const eventTypes = await listEventTypes(user.schoolId);
  const t = await getTranslations("admin.eventTypes");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <EventTypeTable initial={eventTypes} />
    </main>
  );
}
