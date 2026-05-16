import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import "@/app/print.css";
import { getSchoolBySlug } from "@/lib/db/schools";
import { getActiveAcademicYear, listEventTypes } from "@/lib/events/queries";
import { getAgendaForSchool } from "@/lib/views/agenda";
import { buildCalendarModel } from "@/lib/views/calendar";
import { FilterBar } from "@/components/FilterBar";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";

/** PRD §11 freshness target. */
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
 * Printable yearly calendar — one page per month under print media.
 * Same FilterBar + URL-state contract as /agenda; the print stylesheet
 * hides the filter chrome and tiles each month onto its own A4/A3 page.
 */
export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  const grades = parseGradeList(sp.grades);
  const types = parseList(sp.types);
  const q = typeof sp.q === "string" ? sp.q : "";

  const [year, events, eventTypeList] = await Promise.all([
    getActiveAcademicYear(school.id),
    getAgendaForSchool(school.id, {
      grades: grades.length > 0 ? grades : undefined,
      types: types.length > 0 ? types : undefined,
      q: q.trim().length > 0 ? q : undefined,
    }),
    listEventTypes(school.id),
  ]);

  const t = await getTranslations("calendar");

  if (!year) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-neutral-500">
        {t("noActiveYear")}
      </main>
    );
  }

  const model = buildCalendarModel({
    year: { startDate: year.startDate, endDate: year.endDate },
    events,
  });

  return (
    <main className="min-h-screen bg-neutral-100 print:bg-white">
      <header className="bg-white border-b border-neutral-200 px-4 py-3 print:hidden">
        <h1 className="text-lg font-bold">{school.name}</h1>
        <p className="text-xs text-neutral-500">
          {year.label} · {t("subtitle")}
        </p>
      </header>
      <div className="print:hidden">
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
      </div>
      <YearCalendarGrid
        months={model.months}
        yearLabel={year.label}
        schoolName={school.name}
      />
    </main>
  );
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
