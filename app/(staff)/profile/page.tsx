import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Calendar } from "lucide-react";
import { getStaffUser } from "@/lib/auth/session";
import { listSubscriptionsForStaff } from "@/lib/ical/subscriptions";
import { listEventTypes } from "@/lib/events/queries";
import { ProfileSubscriptions } from "@/components/staff/ProfileSubscriptions";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const user = await getStaffUser();
  if (!user) redirect("/auth/login");
  if (!user.schoolId) redirect("/auth/pending");

  const [t, subscriptions, eventTypes] = await Promise.all([
    getTranslations("profile"),
    listSubscriptionsForStaff(user.schoolId, user.id),
    listEventTypes(user.schoolId),
  ]);

  const serializedSubs = subscriptions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    revokedAt: s.revokedAt?.toISOString() ?? null,
  }));

  const eventTypeOptions = eventTypes.map((et) => ({
    id: et.id,
    labelHe: et.labelHe,
    colorHex: et.colorHex,
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold">{t("title")}</h1>

      <section className="mb-10 rounded-lg border border-neutral-200 p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("googleCalendarTitle")}</h2>
        <p className="mb-5 text-sm text-neutral-600">{t("googleCalendarIntro")}</p>
        <form action="/api/v1/ical-subscriptions/gcal" method="POST">
          <Button type="submit" className="flex items-center gap-2">
            <Calendar className="size-4" aria-hidden="true" />
            {t("addToGoogleCalendar")}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">{t("icalTitle")}</h2>
        <p className="mb-4 text-sm text-neutral-600">{t("icalIntro")}</p>
        <ProfileSubscriptions initial={serializedSubs} eventTypes={eventTypeOptions} />
      </section>
    </main>
  );
}
