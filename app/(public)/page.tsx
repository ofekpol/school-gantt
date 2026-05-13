import { getTranslations } from "next-intl/server";
import { listSchools } from "@/lib/db/schools";

/**
 * Public root — lists all schools so an unauthenticated visitor can pick one.
 * Each school links to its Gantt at /<slug>; agenda is one click away.
 *
 * `dynamic = "force-dynamic"` because the schools query needs DATABASE_URL,
 * which is unavailable during `next build` and would fail SSG. Edge caching
 * via Cache-Control is still possible later if needed.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const schools = await listSchools();
  const t = await getTranslations("home");

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold mb-2">{t("title")}</h1>
        <p className="text-sm text-neutral-600 mb-6">{t("subtitle")}</p>
        {schools.length === 0 ? (
          <p className="text-neutral-500">—</p>
        ) : (
          <ul className="space-y-3">
            {schools.map((school) => (
              <li
                key={school.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{school.name}</p>
                  <p className="text-xs text-neutral-500 truncate">
                    /{school.slug}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={`/${school.slug}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t("viewGantt")}
                  </a>
                  <a
                    href={`/${school.slug}/agenda`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t("viewAgenda")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
