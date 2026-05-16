import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSchoolBySlug } from "@/lib/db/schools";
import { getActiveAcademicYear, listEventTypes } from "@/lib/events/queries";
import { getAgendaForSchool } from "@/lib/views/agenda";
import { buildGanttModel, parseZoom } from "@/lib/views/gantt";
import { buildWeeklyModel, parseWeekParam } from "@/lib/views/gantt-weekly";
import { FilterBar } from "@/components/FilterBar";
import { GanttCanvas } from "@/components/Gantt/GanttCanvas";
import { GanttWeekly } from "@/components/Gantt/GanttWeekly";
import { LocaleToggle } from "@/components/LocaleToggle";

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
    week?: string;
  }>;
}

export default async function GanttPage({ params, searchParams }: PageProps) {
  const { school: slug } = await params;
  const sp = await searchParams;

  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  const [year, eventTypeList] = await Promise.all([
    getActiveAcademicYear(school.id),
    listEventTypes(school.id),
  ]);

  const t = await getTranslations("gantt");

  if (!year) {
    return <NoYearState schoolName={school.name} />;
  }

  const zoom = parseZoom(typeof sp.zoom === "string" ? sp.zoom : undefined);
  const filters = parseFilters(sp);

  const events = await getAgendaForSchool(school.id, filters);

  const eventTypesForFilter = eventTypeList.map((et) => ({
    key: et.key,
    labelHe: et.labelHe,
    colorHex: et.colorHex,
  }));

  const selectedGrades = parseGradeList(sp.grades);
  const selectedTypes = parseList(sp.types);

  const navLinks = [
    { id: "gantt",    label: "גאנט",    href: `/${slug}` },
    { id: "calendar", label: "לוח שנה", href: `/${slug}/calendar` },
    { id: "agenda",   label: "סדר יום", href: `/${slug}/agenda` },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "var(--sg-bg)", fontFamily: "var(--sg-font-ui)" }}>
      {/* App header */}
      <header style={{
        display: "flex", alignItems: "center", gap: 24,
        padding: "0 24px", height: 60,
        background: "var(--sg-surface)",
        borderBottom: "1px solid var(--sg-hairline)",
        position: "sticky", top: 0, zIndex: 30,
      }}>
        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, display: "grid", placeItems: "center",
            background: "var(--sg-ink)", color: "var(--sg-bg)",
            fontFamily: "var(--sg-font-display)", fontWeight: 700, fontSize: 15,
            borderRadius: 7,
          }}>
            ל״ג
          </div>
          <div>
            <div style={{ fontFamily: "var(--sg-font-display)", fontSize: 17, fontWeight: 600, lineHeight: 1 }}>
              לוח-גן
            </div>
          </div>
          <div style={{
            fontSize: 14, color: "var(--sg-ink-mute)",
            display: "flex", alignItems: "center", gap: 8,
            paddingInlineStart: 14, marginInlineStart: 8,
            borderInlineStart: "1px solid var(--sg-hairline)",
          }}>
            <span>{school.name}</span>
          </div>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: "flex", alignItems: "center", gap: 4, marginInlineStart: 12 }}>
          {navLinks.map((n) => (
            <a
              key={n.id}
              href={n.href}
              style={{
                display: "inline-flex", alignItems: "center",
                padding: "7px 12px", borderRadius: 7,
                textDecoration: "none", fontSize: 13, fontWeight: 500,
                color: n.id === "gantt" ? "var(--sg-ink)" : "var(--sg-ink-mute)",
                background: n.id === "gantt" ? "var(--sg-bg-deep)" : "transparent",
              }}
            >
              {n.label}
            </a>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            fontSize: 13, color: "var(--sg-ink-mute)",
            fontFamily: "var(--sg-font-display)",
          }}>
            {year.label}
          </div>
          <LocaleToggle />
        </div>
      </header>

      {/* Filter bar */}
      <FilterBar
        allGrades={ALL_GRADES}
        eventTypes={eventTypesForFilter}
        selectedGrades={selectedGrades}
        selectedTypes={selectedTypes}
        searchQuery={typeof sp.q === "string" ? sp.q : ""}
        zoom={zoom}
      />

      {/* Gantt view */}
      {zoom === "week"
        ? (() => {
            const weekStart = parseWeekParam(typeof sp.week === "string" ? sp.week : undefined);
            const model = buildWeeklyModel(weekStart, events, ALL_GRADES, new Date());
            return (
              <GanttWeekly
                model={model}
                events={events.map((e) => ({
                  ...e,
                  startAt: e.startAt.toISOString(),
                  endAt: e.endAt.toISOString(),
                }))}
              />
            );
          })()
        : (() => {
            const model = buildGanttModel({
              year: { startDate: year.startDate, endDate: year.endDate },
              grades: ALL_GRADES,
              events,
            });
            return (
              <GanttCanvas
                events={events.map((e) => ({
                  ...e,
                  startAt: e.startAt.toISOString(),
                  endAt: e.endAt.toISOString(),
                }))}
                bars={model.bars}
                months={model.months}
                grades={ALL_GRADES}
                zoom={zoom}
                emptyLabel={t("empty")}
              />
            );
          })()}
    </main>
  );
}

function NoYearState({ schoolName }: { schoolName: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "var(--sg-bg)", fontFamily: "var(--sg-font-ui)" }}>
      <header style={{
        display: "flex", alignItems: "center",
        padding: "0 24px", height: 60,
        background: "var(--sg-surface)", borderBottom: "1px solid var(--sg-hairline)",
      }}>
        <div style={{
          width: 32, height: 32, display: "grid", placeItems: "center",
          background: "var(--sg-ink)", color: "var(--sg-bg)",
          fontFamily: "var(--sg-font-display)", fontWeight: 700, fontSize: 15, borderRadius: 7,
        }}>ל״ג</div>
        <span style={{ marginInlineStart: 10, fontFamily: "var(--sg-font-display)", fontSize: 17, fontWeight: 600 }}>
          {schoolName}
        </span>
      </header>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "70vh", gap: 16, textAlign: "center", padding: 24,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 12,
          background: "var(--sg-bg-deep)", display: "grid", placeItems: "center",
          color: "var(--sg-ink-soft)", fontSize: 32,
        }}>
          📅
        </div>
        <h1 style={{ fontFamily: "var(--sg-font-display)", fontSize: 24, fontWeight: 600, color: "var(--sg-ink)", margin: 0 }}>
          טרם הוגדרה שנת לימודים פעילה
        </h1>
        <p style={{ fontSize: 14, color: "var(--sg-ink-mute)", maxWidth: 400 }}>
          על מנהל בית הספר להגדיר שנת לימודים לפני שניתן לצפות באירועים.
        </p>
      </div>
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
