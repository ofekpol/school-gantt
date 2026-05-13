import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { listSubscriptionsForStaff } from "@/lib/ical/subscriptions";
import { listEventTypes } from "@/lib/events/queries";
import { ProfileSubscriptions } from "@/components/staff/ProfileSubscriptions";

/**
 * Staff profile — server component.
 * Currently exposes the iCal subscriptions list (Phase 7). Future phases
 * may add password change, locale toggle, etc. here.
 */
export default async function ProfilePage() {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const [subs, eventTypes] = await Promise.all([
    listSubscriptionsForStaff(user.schoolId, user.id),
    listEventTypes(user.schoolId),
  ]);

  const t = await getTranslations("profile");

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{t("title")}</h1>
      <p className="text-sm text-neutral-500 mb-6">{user.email}</p>
      <section>
        <h2 className="text-lg font-semibold mb-3">{t("icalTitle")}</h2>
        <p className="text-sm text-neutral-600 mb-4">{t("icalIntro")}</p>
        <ProfileSubscriptions
          initial={subs.map((s) => ({
            id: s.id,
            token: s.token,
            filterGrades: s.filterGrades,
            filterEventTypes: s.filterEventTypes,
            createdAt: s.createdAt.toISOString(),
            revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
          }))}
          eventTypes={eventTypes.map((et) => ({
            id: et.id,
            labelHe: et.labelHe,
            colorHex: et.colorHex,
          }))}
        />
      </section>
    </main>
  );
}
