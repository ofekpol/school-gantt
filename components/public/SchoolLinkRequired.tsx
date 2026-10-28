import { useTranslations } from "next-intl";

/**
 * Guest entry without a valid school link. Deliberately reveals nothing about
 * which schools exist — the secret link is the only way to a school's calendar.
 */
export function SchoolLinkRequired() {
  const t = useTranslations("schedule.linkRequired");
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 p-8 border rounded-lg shadow-sm text-center">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
      </div>
    </main>
  );
}
