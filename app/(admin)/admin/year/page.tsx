import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { listAcademicYears } from "@/lib/admin/years";
import { getActiveAcademicYear } from "@/lib/events/queries";
import { YearForm } from "@/components/admin/YearForm";

/**
 * Admin academic year management page — Server Component.
 * Lists academic years, allows creating a new year, and setting one as active.
 * ADMIN-03 entry point.
 */
export default async function AdminYearPage() {
  const user = await getStaffUser();
  if (!user) redirect("/");

  const [years, active] = await Promise.all([
    listAcademicYears(user.schoolId),
    getActiveAcademicYear(user.schoolId),
  ]);

  const t = await getTranslations("admin.year");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <YearForm initial={years} activeId={active?.id ?? null} />
    </main>
  );
}
