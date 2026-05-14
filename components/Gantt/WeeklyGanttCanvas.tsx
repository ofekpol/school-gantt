"use client";

import { useState } from "react";
import type { WeeklyGanttDay, WeeklyGanttModel, WeeklyCell } from "@/lib/views/weeklyGantt";
import { DAY_START_HOUR, DAY_END_HOUR } from "@/lib/views/weeklyGantt";
import type { AgendaItem } from "@/lib/views/agenda";
import { EventDrawer } from "./EventDrawer";

// Layout constants — matching the design spec
const AXIS_H = 72;     // day-header height in px
const GRADE_ROW_H = 120; // height of each grade row in px
const GRADE_COL_W = 80;  // grade-label column width in px
const LANE_H = 28;     // event bar height in px
const LANE_GAP = 4;    // gap between event lanes in px
const ROW_PAD_TOP = 12; // top padding inside each grade row in px

interface SerializedAgendaItem extends Omit<AgendaItem, "startAt" | "endAt"> {
  startAt: Date | string;
  endAt: Date | string;
}

interface Props {
  model: WeeklyGanttModel;
  events: SerializedAgendaItem[];
  emptyLabel: string;
}

export function WeeklyGanttCanvas({ model, events, emptyLabel }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const eventMap = new Map<string, AgendaItem>();
  for (const e of events) {
    eventMap.set(e.id, {
      ...e,
      startAt: new Date(e.startAt),
      endAt: new Date(e.endAt),
    });
  }

  const selected = selectedId ? (eventMap.get(selectedId) ?? null) : null;

  const totalEvents = model.gradeRows.reduce(
    (s, r) => s + r.cells.length,
    0,
  );

  if (totalEvents === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-100 grid place-items-center text-neutral-400">
          <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 5h7M5 9h9M7 13h11M5 17h6"/>
          </svg>
        </div>
        <p className="text-lg font-semibold text-neutral-700">{emptyLabel}</p>
      </div>
    );
  }

  const totalH = AXIS_H + model.gradeRows.length * GRADE_ROW_H;

  return (
    <>
      <div
        className="relative overflow-x-auto border border-neutral-200 rounded-xl bg-white"
        style={{ margin: "0 24px 16px" }}
      >
        {/* Grid: [timeline 1fr] [grade-labels GRADE_COL_W] — RTL renders timeline on right */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `1fr ${GRADE_COL_W}px`,
            gridTemplateRows: `${AXIS_H}px 1fr`,
            height: totalH,
          }}
        >
          {/* ─── Day axis header ─── */}
          <WeekAxis days={model.days} />

          {/* Grade column header */}
          <div
            className="flex items-end pb-3 px-3 bg-neutral-50 border-s border-neutral-200"
            style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--ink-soft)" }}
          >
            <span className="text-xs text-neutral-400">שכבות</span>
          </div>

          {/* ─── Grade rows (timeline column) ─── */}
          <div className="relative">
            {/* Today vertical line */}
            {model.todayDayIdx !== null && (
              <TodayLine dayIdx={model.todayDayIdx} />
            )}

            {model.gradeRows.map((row) => (
              <GradeRow
                key={row.grade}
                cells={row.cells}
                days={model.days}
                onSelect={setSelectedId}
              />
            ))}
          </div>

          {/* ─── Grade label column ─── */}
          <div className="border-s border-neutral-200 bg-neutral-50">
            {model.gradeRows.map((row) => (
              <div
                key={row.grade}
                className="flex flex-col justify-center gap-1 px-3 border-b border-neutral-100 last:border-b-0"
                style={{ height: GRADE_ROW_H }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 24,
                    fontWeight: 600,
                    lineHeight: 1,
                    color: "var(--ink)",
                  }}
                >
                  {row.gradeLabel}
                </span>
                <span
                  className="font-mono text-[10px] text-neutral-400"
                  style={{ letterSpacing: "0.04em" }}
                >
                  {row.cells.length} אירועים
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Type legend */}
      <TypeLegend />

      <EventDrawer event={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}

// ─── Day axis ────────────────────────────────────────────────────

function WeekAxis({ days }: { days: WeeklyGanttDay[] }) {
  return (
    <div
      className="grid border-b border-neutral-200 bg-neutral-50"
      style={{ gridTemplateColumns: "repeat(7, 1fr)", height: AXIS_H }}
    >
      {days.map((d) => (
        <DayCell key={d.idx} day={d} />
      ))}
    </div>
  );
}

function DayCell({ day }: { day: WeeklyGanttDay }) {
  const isToday = day.isToday;
  const isWeekend = day.isWeekend;

  return (
    <div
      className="flex flex-col justify-end gap-0.5 border-s border-neutral-100 px-4 pb-3"
      style={{
        background: isToday
          ? "var(--accent-soft)"
          : isWeekend
          ? "color-mix(in oklch, var(--bg-deep) 60%, white)"
          : "transparent",
      }}
    >
      <div className="flex items-baseline gap-2">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1,
            color: isToday
              ? "var(--accent-ink)"
              : isWeekend
              ? "var(--ink-soft)"
              : "var(--ink)",
          }}
        >
          {day.dayNum}
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 500,
            color: isToday
              ? "var(--accent-ink)"
              : isWeekend
              ? "var(--ink-soft)"
              : "var(--ink-mute)",
          }}
        >
          {day.dayNameHe}
        </span>
      </div>
      <div
        className="font-mono text-[10px] flex items-center gap-2"
        style={{
          color: isToday ? "var(--accent)" : "var(--ink-soft)",
          letterSpacing: "0.06em",
        }}
      >
        <span>{day.dayMonoEn}</span>
        {isToday && (
          <span
            className="text-[9px] font-bold"
            style={{ color: "var(--accent)", textTransform: "uppercase" }}
          >
            היום
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Today line ──────────────────────────────────────────────────

function TodayLine({ dayIdx }: { dayIdx: number }) {
  // Position at mid-day (can be enhanced to use real time client-side)
  const HOUR_RANGE = DAY_END_HOUR - DAY_START_HOUR;
  const midHour = (DAY_START_HOUR + DAY_END_HOUR) / 2;
  const within = (midHour - DAY_START_HOUR) / HOUR_RANGE;
  const pct = ((dayIdx + within) / 7) * 100;

  return (
    <div
      className="absolute top-0 bottom-0 z-10 pointer-events-none"
      style={{
        insetInlineStart: `${pct}%`,
        borderInlineEnd: "2px solid var(--accent)",
      }}
    >
      <div
        className="absolute font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
        style={{
          top: -20,
          insetInlineEnd: -28,
          background: "var(--accent)",
          color: "white",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        היום
      </div>
    </div>
  );
}

// ─── Grade row with events ───────────────────────────────────────

function GradeRow({
  cells,
  days,
  onSelect,
}: {
  cells: WeeklyCell[];
  days: WeeklyGanttDay[];
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="relative border-b border-neutral-100 last:border-b-0"
      style={{ height: GRADE_ROW_H }}
    >
      {/* Day column dividers */}
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
      >
        {days.map((d) => (
          <div
            key={d.idx}
            className="border-s border-neutral-100"
            style={{
              background: d.isWeekend
                ? "repeating-linear-gradient(135deg, transparent 0 8px, color-mix(in oklch, var(--bg-deep) 80%, transparent) 8px 9px)"
                : d.isToday
                ? "color-mix(in oklch, var(--accent-soft) 22%, transparent)"
                : "transparent",
            }}
          />
        ))}
      </div>

      {/* Event bars */}
      {cells.map((cell) => (
        <EventBar key={cell.id} cell={cell} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ─── Event bar ───────────────────────────────────────────────────

function EventBar({
  cell,
  onSelect,
}: {
  cell: WeeklyCell;
  onSelect: (id: string) => void;
}) {
  const isSolid =
    cell.eventTypeKey === "vacation" || cell.eventTypeKey === "bagrut";

  return (
    <button
      type="button"
      onClick={() => onSelect(cell.eventId)}
      title={cell.title}
      className="absolute flex items-center gap-1.5 rounded-[5px] text-xs font-medium overflow-hidden text-start focus-visible:outline-2 focus-visible:outline-blue-500"
      style={{
        insetInlineStart: `${cell.leftPct}%`,
        width: `${cell.widthPct}%`,
        top: ROW_PAD_TOP + cell.lane * (LANE_H + LANE_GAP),
        height: LANE_H,
        minWidth: 48,
        padding: "0 8px 0 10px",
        background: isSolid
          ? cell.eventTypeColor
          : `color-mix(in oklch, ${cell.eventTypeColor} 15%, white)`,
        color: isSolid ? "white" : "var(--ink)",
        borderInlineEnd: `3px solid ${cell.eventTypeColor}`,
      }}
    >
      {/* Type glyph */}
      <EventGlyph glyph={cell.eventTypeGlyph} color={isSolid ? "rgba(255,255,255,0.85)" : cell.eventTypeColor} />

      {/* Start time */}
      {!cell.isAllDay && cell.startHourFmt && (
        <span
          className="font-mono shrink-0"
          style={{
            fontSize: 10,
            opacity: isSolid ? 0.85 : 0.65,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {cell.startHourFmt}
        </span>
      )}

      {/* Title */}
      <span className="truncate flex-1 min-w-0">{cell.title}</span>
    </button>
  );
}

// ─── Inline SVG glyph ────────────────────────────────────────────

const GLYPHS: Record<string, React.ReactNode> = {
  book: <><path d="M3 4a2 2 0 0 1 2-2h12v18H5a2 2 0 0 0-2 2V4Z"/><path d="M17 2v18"/></>,
  party: <><path d="M5 19l1.5-5.5L13 8l3 3-6 6L5 19Z"/><path d="M17 4v2M19 6h-2"/></>,
  pencil: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></>,
  mountain: <><path d="M2 21l6-10 5 7"/><path d="M11 16l3-5 7 10H2"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-4 8-4-8 4 4 4-4Z"/></>,
  flag: <><path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="8" r="3"/><path d="M14 15c3 0 7 1 7 5"/></>,
  cap: <><path d="M22 10 12 4 2 10l10 6 10-6Z"/><path d="M6 12v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4"/></>,
  heart: <><path d="M19.5 12.6 12 20l-7.5-7.4a4.5 4.5 0 0 1 6.4-6.3L12 7l1.1-.7a4.5 4.5 0 0 1 6.4 6.3Z"/></>,
  tag: <><path d="M3 12V3h9l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/></>,
};

function EventGlyph({ glyph, color }: { glyph: string; color: string }) {
  const paths = GLYPHS[glyph] ?? GLYPHS.tag;
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {paths}
    </svg>
  );
}

// ─── Type legend ─────────────────────────────────────────────────

const LEGEND_TYPES = [
  { key: "pedagogical", label: "פדגוגי", color: "oklch(0.58 0.12 245)" },
  { key: "social", label: "חברתי", color: "oklch(0.66 0.16 25)" },
  { key: "exam", label: "מבחן", color: "oklch(0.52 0.14 22)" },
  { key: "trip", label: "טיול", color: "oklch(0.55 0.12 150)" },
  { key: "specTour", label: "סיור מגמה", color: "oklch(0.58 0.10 200)" },
  { key: "shlach", label: "של״ח", color: "oklch(0.55 0.09 110)" },
  { key: "vacation", label: "חופשה", color: "oklch(0.72 0.13 80)" },
  { key: "parents", label: "הורים", color: "oklch(0.55 0.13 305)" },
  { key: "bagrut", label: "בגרות", color: "oklch(0.42 0.16 18)" },
  { key: "counseling", label: "ייעוץ", color: "oklch(0.60 0.10 330)" },
  { key: "other", label: "אחר", color: "oklch(0.62 0.010 60)" },
] as const;

function TypeLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 bg-white border-t border-neutral-200"
      style={{ fontSize: 12 }}
    >
      <span className="text-neutral-400 me-1" style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>
        מקרא
      </span>
      {LEGEND_TYPES.map((t) => (
        <span key={t.key} className="inline-flex items-center gap-1.5 text-neutral-500">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: t.color }}
          />
          {t.label}
        </span>
      ))}
    </div>
  );
}
