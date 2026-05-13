import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSchoolBySlug } from "@/lib/db/schools";
import { getActiveAcademicYear, listEventTypes } from "@/lib/events/queries";
import { getAgendaForSchool } from "@/lib/views/agenda";
import { buildGanttModel, parseZoom } from "@/lib/views/gantt";
import { FilterBar } from "@/components/FilterBar";
import { GanttCanvas } from "@/components/Gantt/GanttCanvas";
import { ZoomToggle } from "@/components/Gantt/ZoomToggle";

/** PRD §11 — public freshness ≤ 5 s after admin approval. */
export const revalidate = 5;

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

interface PageProps {
  params: Promise<{ school: string }>;
  searchParams: Promise<{
    grades?: string | string[];
    types?: string | string[];
    q?: string;
    zoom?: string;
  }>;
}

/**
 * Public Gantt — horizontal Sept..Jul timeline, one row per grade.
 *
 * Server-renders all positioned bars so first paint hits the 2 s / 1 k events
 * budget without a client-side layout pass; the client component then handles
 * scroll, zoom, and click-to-open detail interactions.
 */
export default async function GanttPage({ params, searchParams }: PageProps) {
  const { school: slug } = await params;
  const sp = await searchParams;

  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  const [year, events, eventTypeList] = await Promise.all([
    getActiveAcademicYear(school.id),
    getAgendaForSchool(school.id, parseFilters(sp)),
    listEventTypes(school.id),
  ]);

  const t = await getTranslations("gantt");

  if (!year) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-neutral-500">
        {t("noActiveYear")}
      </main>
    );
  }

  const zoom = parseZoom(typeof sp.zoom === "string" ? sp.zoom : undefined);
  const model = buildGanttModel({
    year: { startDate: year.startDate, endDate: year.endDate },
    grades: ALL_GRADES,
    events,
  });

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{school.name}</h1>
          <p className="text-xs text-neutral-500">{year.label}</p>
        </div>
        <ZoomToggle zoom={zoom} />
      </header>
      <FilterBar
        allGrades={ALL_GRADES}
        eventTypes={eventTypeList.map((et) => ({
          key: et.key,
          labelHe: et.labelHe,
          colorHex: et.colorHex,
        }))}
        selectedGrades={parseGradeList(sp.grades)}
        selectedTypes={parseList(sp.types)}
        searchQuery={typeof sp.q === "string" ? sp.q : ""}
      />
      <GanttCanvas
        events={events}
        bars={model.bars}
        months={model.months}
        grades={ALL_GRADES}
        zoom={zoom}
        emptyLabel={t("empty")}
      />
    </main>
  );
}

function parseFilters(sp: {
  grades?: string | string[];
  types?: string | string[];
  q?: string;
}) {
  const grades = parseGradeList(sp.grades);
  const types = parseList(sp.types);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  return {
    grades: grades.length > 0 ? grades : undefined,
    types: types.length > 0 ? types : undefined,
    q: q.length > 0 ? q : undefined,
  };
}

function parseList(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
}

function parseGradeList(v: string | string[] | undefined): number[] {
  return parseList(v)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 7 && n <= 12);
}
