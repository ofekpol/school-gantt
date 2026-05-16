import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { listStaffUsers } from "@/lib/db/staff";
import { listInvitesForSchool } from "@/lib/db/invites";
import { listPendingRegistrations } from "@/lib/db/pending";
import { listEventTypes } from "@/lib/admin/event-types";
import { StaffTable } from "@/components/admin/StaffTable";
import { PendingRequestsTable } from "@/components/admin/PendingRequestsTable";
import { InviteForm } from "@/components/admin/InviteForm";
import { InviteTable } from "@/components/admin/InviteTable";

/**
 * Admin staff management page — Server Component.
 * Lists all staff in the school with create/edit/deactivate controls.
 * ADMIN-01 entry point.
 */
export default async function AdminStaffPage() {
  const user = await getStaffUser();
  if (!user?.schoolId) redirect("/auth/login");

  const [staff, eventTypes, pendingRegs, invites] = await Promise.all([
    listStaffUsers(user.schoolId),
    listEventTypes(user.schoolId),
    listPendingRegistrations(),
    listInvitesForSchool(user.schoolId),
  ]);

  const t = await getTranslations("admin.staff");

  return (
    <main className="space-y-8 p-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("activeStaff")}</h2>
        <StaffTable initialStaff={staff} eventTypes={eventTypes} />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("pendingRequests")}</h2>
        <PendingRequestsTable pending={pendingRegs} eventTypes={eventTypes} />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("invites")}</h2>
        <InviteForm eventTypes={eventTypes} />
        <InviteTable invites={invites} />
      </section>
    </main>
  );
}
