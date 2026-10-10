import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { listEventTypes } from "@/lib/admin/event-types";
import { EventTypeTable } from "@/components/admin/EventTypeTable";
import { GradeColorSettings } from "@/components/admin/GradeColorSettings";
import { getGradeColors } from "@/lib/db/grade-colors";

/**
 * Admin event-types management page — Server Component.
 * Lists all event types with create/edit/delete controls; admins also get the
 * per-grade calendar color settings.
 * ADMIN-02 entry point.
 */
export default async function AdminEventTypesPage() {
  const user = await getStaffUser();
  if (!user || !user.schoolId) redirect("/");
  if (user.role === "viewer") redirect("/dashboard");

  const isAdmin = user.role === "admin";
  const [eventTypes, gradeColors] = await Promise.all([
    listEventTypes(user.schoolId),
    isAdmin ? getGradeColors(user.schoolId) : Promise.resolve(null),
  ]);
  const t = await getTranslations("admin.eventTypes");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <EventTypeTable initial={eventTypes} canManage={isAdmin} />
      {gradeColors && <GradeColorSettings initial={gradeColors} />}
    </main>
  );
}
