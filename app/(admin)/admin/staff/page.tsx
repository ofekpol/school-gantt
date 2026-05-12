import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { listStaffUsers } from "@/lib/db/staff";
import { listEventTypes } from "@/lib/admin/event-types";
import { StaffTable } from "@/components/admin/StaffTable";

/**
 * Admin staff management page — Server Component.
 * Lists all staff in the school with create/edit/deactivate controls.
 * ADMIN-01 entry point.
 */
export default async function AdminStaffPage() {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const [staff, eventTypes] = await Promise.all([
    listStaffUsers(user.schoolId),
    listEventTypes(user.schoolId),
  ]);

  const t = await getTranslations("admin.staff");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <StaffTable initialStaff={staff} eventTypes={eventTypes} />
    </main>
  );
}
