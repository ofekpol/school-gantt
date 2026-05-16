import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSchoolBySlug } from "@/lib/db/schools";
import { listEventTypes } from "@/lib/events/queries";
import { getAgendaForSchool, groupByWeek } from "@/lib/views/agenda";
import { FilterBar } from "@/components/FilterBar";
import { AgendaList } from "@/components/AgendaList";

/**
 * PRD §11 freshness target: ≤ 5 s after admin approves. Next.js ISR with
 * revalidate=5 satisfies this — the rendered HTML is served from cache for
 * up to 5 s, then re-rendered against the latest approved events.
 */
export const revalidate = 5;

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

interface PageProps {
  params: Promise<{ school: string }>;
  searchParams: Promise<{
    grades?: string | string[];
    types?: string | string[];
    q?: string;
  }>;
}

/**
 * Public, unauthenticated mobile agenda for a school (Phase 4).
 * URL: /:school/agenda?grades=10&types=trip&q=...
 * Filters round-trip through the URL so the view is shareable.
 */
export default async function AgendaPage({ params, searchParams }: PageProps) {
  const { school: slug } = await params;
  const sp = await searchParams;

  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  const grades = parseMulti(sp.grades)
    .map((g) => Number(g))
    .filter((g) => Number.isInteger(g) && g >= 7 && g <= 12);
  const types = parseMulti(sp.types);
  const q = typeof sp.q === "string" ? sp.q : "";

  const [items, eventTypeList] = await Promise.all([
    getAgendaForSchool(school.id, {
      grades: grades.length > 0 ? grades : undefined,
      types: types.length > 0 ? types : undefined,
      q: q.trim().length > 0 ? q : undefined,
    }),
    listEventTypes(school.id),
  ]);

  const weeks = groupByWeek(items);
  const t = await getTranslations("agenda");

  return (
    <main className="min-h-screen bg-neutral-50 pb-12">
      <header className="bg-white border-b border-neutral-200 px-4 py-3 sticky top-0 z-10">
        <h1 className="text-lg font-bold">{school.name}</h1>
        <p className="text-xs text-neutral-500">{t("subtitle")}</p>
      </header>
      <FilterBar
        allGrades={ALL_GRADES}
        eventTypes={eventTypeList.map((et) => ({
          key: et.key,
          labelHe: et.labelHe,
          colorHex: et.colorHex,
        }))}
        selectedGrades={grades}
        selectedTypes={types}
        zoom="year"
        searchQuery={q}
      />
      <AgendaList weeks={weeks} emptyLabel={t("empty")} />
    </main>
  );
}

function parseMulti(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
