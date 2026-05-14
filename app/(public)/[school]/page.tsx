import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSchoolBySlug } from "@/lib/db/schools";
import { getActiveAcademicYear, listEventTypes } from "@/lib/events/queries";
import { getAgendaForSchool } from "@/lib/views/agenda";
import { buildGanttModel, parseZoom } from "@/lib/views/gantt";
import {
  buildWeeklyGanttModel,
  getTodayISO,
  getWeekStartISO,
  shiftWeek,
} from "@/lib/views/weeklyGantt";
import { FilterBar } from "@/components/FilterBar";
import { GanttCanvas } from "@/components/Gantt/GanttCanvas";
import { WeeklyGanttCanvas } from "@/components/Gantt/WeeklyGanttCanvas";

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
    week?: string; // YYYY-MM-DD (Sunday start) for weekly view
  }>;
}

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
  const zoom = parseZoom(typeof sp.zoom === "string" ? sp.zoom : undefined);
  const todayISO = getTodayISO();

  // ── No active year ────────────────────────────────────────────
  if (!year) {
    return (
      <div className="sg-app min-h-screen flex flex-col">
        <PublicHeader school={school} zoom={zoom} slug={slug} />
        <div className="flex-1 m-6 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center gap-5 text-center p-14">
          <div className="w-18 h-18 rounded-xl bg-neutral-100 grid place-items-center text-neutral-400">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {t("noActiveYear")}
          </h1>
          <p className="text-sm text-neutral-500 max-w-sm">
            על מנהל בית הספר להגדיר שנת לימודים פעילה לפני שניתן לצפות באירועים.
          </p>
        </div>
      </div>
    );
  }

  // ── Weekly view ───────────────────────────────────────────────
  if (zoom === "week") {
    const rawWeek = typeof sp.week === "string" ? sp.week : undefined;
    const weekStartISO = getWeekStartISO(rawWeek ?? todayISO);
    const prevWeek = shiftWeek(weekStartISO, -1);
    const nextWeek = shiftWeek(weekStartISO, 1);
    const thisWeek = getWeekStartISO(todayISO);

    const weeklyModel = buildWeeklyGanttModel({
      weekStartISO,
      grades: ALL_GRADES,
      events,
      todayISO,
    });

    // Format week label
    const startDay = weeklyModel.days[0];
    const endDay = weeklyModel.days[6];
    const monthFmt = new Intl.DateTimeFormat("he-IL", {
      timeZone: "Asia/Jerusalem",
      month: "long",
    });
    const weekLabel = `${startDay.dayNum}–${endDay.dayNum} ב${monthFmt.format(new Date(`${endDay.iso}T00:00:00Z`))}`;

    return (
      <div className="sg-app min-h-screen flex flex-col bg-[var(--bg)]">
        <PublicHeader school={school} zoom={zoom} slug={slug} />
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
          zoom={zoom}
        />

        {/* Week navigation */}
        <div className="flex items-baseline gap-4 px-6 py-4">
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            שבוע {weekLabel}
          </h1>
          <span
            className="font-mono text-[11px] text-neutral-400"
            style={{ letterSpacing: "0.04em" }}
          >
            {year.label}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <Link
              href={`/${slug}?zoom=week&week=${prevWeek}` as never}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 transition-colors text-sm"
              aria-label="שבוע קודם"
            >
              ›
            </Link>
            <Link
              href={`/${slug}?zoom=week&week=${thisWeek}` as never}
              className="inline-flex items-center h-8 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              היום
            </Link>
            <Link
              href={`/${slug}?zoom=week&week=${nextWeek}` as never}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 transition-colors text-sm"
              aria-label="שבוע הבא"
            >
              ‹
            </Link>
          </div>
        </div>

        <WeeklyGanttCanvas
          model={weeklyModel}
          events={events}
          emptyLabel={t("empty")}
        />
      </div>
    );
  }

  // ── Year / term / month bar view ──────────────────────────────
  const model = buildGanttModel({
    year: { startDate: year.startDate, endDate: year.endDate },
    grades: ALL_GRADES,
    events,
  });

  return (
    <div className="sg-app min-h-screen flex flex-col bg-[var(--bg)]">
      <PublicHeader school={school} zoom={zoom} slug={slug} />
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
        zoom={zoom}
      />
      <GanttCanvas
        events={events}
        bars={model.bars}
        months={model.months}
        grades={ALL_GRADES}
        zoom={zoom}
        emptyLabel={t("empty")}
      />
    </div>
  );
}

// ─── Shared header ────────────────────────────────────────────────

interface School {
  id: string;
  name: string;
  slug: string;
}

function PublicHeader({
  school,
  zoom,
  slug,
}: {
  school: School;
  zoom: string;
  slug: string;
}) {
  const navItems = [
    { id: "gantt", label: "גאנט", href: `/${slug}?zoom=week` },
    { id: "calendar", label: "לוח שנה", href: `/${slug}/calendar` },
    { id: "agenda", label: "סדר יום", href: `/${slug}/agenda` },
  ];
  const active = zoom === "week" || zoom === "year" || zoom === "term" || zoom === "month"
    ? "gantt"
    : "gantt";

  return (
    <header
      className="flex items-center gap-6 px-6 bg-white border-b border-neutral-200"
      style={{ height: 60 }}
    >
      {/* Mark / logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg grid place-items-center text-white text-base font-bold"
          style={{
            background: "var(--ink)",
            fontFamily: "var(--font-display)",
            fontSize: 15,
          }}
        >
          ל״ג
        </div>
        <span
          className="text-[17px] font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          לוח-גן
        </span>
        <span className="flex items-center gap-2 text-sm text-neutral-500 border-s border-neutral-200 ps-6 ms-2">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 10 12 4 2 10l10 6 10-6Z"/><path d="M6 12v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4"/>
          </svg>
          {school.name}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1 ms-3">
        {navItems.map((n) => (
          <Link
            key={n.id}
            href={n.href as never}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
            style={{
              color: active === n.id ? "var(--ink)" : "var(--ink-mute)",
              background: active === n.id ? "var(--bg-deep)" : "transparent",
              textDecoration: "none",
            }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

// ─── Filter helpers ───────────────────────────────────────────────

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
  return arr
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseGradeList(v: string | string[] | undefined): number[] {
  return parseList(v)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 7 && n <= 12);
}
