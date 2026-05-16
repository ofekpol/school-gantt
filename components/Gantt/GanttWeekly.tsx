"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WeeklyModel, WeeklyEventBar } from "@/lib/views/gantt-weekly";
import { EventDrawer } from "./EventDrawer";

/* ---- Layout constants ---- */
const AXIS_H = 72;
const ROW_H = 116;
const LANE_H = 26;
const LANE_GAP = 4;
const ROW_PAD = 12;
const GRADE_COL_W = 88;

interface SerializedEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  description: string | null;
  location: string | null;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  grades: number[];
}

interface Props {
  model: WeeklyModel;
  events: SerializedEvent[];
}

export function GanttWeekly({ model, events }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const eventMap = new Map(events.map((e) => [e.id, {
    ...e,
    startAt: new Date(e.startAt),
    endAt: new Date(e.endAt),
  }]));

  const selected = selectedId ? (eventMap.get(selectedId) ?? null) : null;

  function navigate(delta: number) {
    const next = new Date(model.weekStart.getTime() + delta * 7 * 24 * 60 * 60 * 1000);
    const iso = next.toISOString().slice(0, 10);
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", iso);
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
  }

  const todayIndex = model.days.findIndex((d) => d.isToday);

  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: "var(--sg-font-ui)" }}>
      {/* Week navigation */}
      <WeekNav model={model} onPrev={() => navigate(-1)} onNext={() => navigate(1)} />

      {/* Gantt body */}
      <div style={{
        margin: "0 24px 16px",
        background: "var(--sg-surface)",
        border: "1px solid var(--sg-hairline)",
        borderRadius: 12,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: `1fr ${GRADE_COL_W}px`,
        gridTemplateRows: `${AXIS_H}px 1fr`,
        position: "relative",
      }}>
        {/* Day axis */}
        <DayAxis days={model.days} />

        {/* Grades column header */}
        <div style={{
          borderInlineStart: "1px solid var(--sg-hairline)",
          background: "var(--sg-surface-2)",
          display: "flex", alignItems: "flex-end",
          padding: "0 14px 12px",
        }}>
          <span style={{ fontFamily: "var(--sg-font-display)", fontSize: 12, color: "var(--sg-ink-soft)" }}>
            שכבות
          </span>
        </div>

        {/* Timeline body */}
        <div style={{ position: "relative" }}>
          {todayIndex >= 0 && <TodayLine dayIndex={todayIndex} />}
          {model.rows.map((row) => (
            <GradeRow
              key={row.grade}
              row={row}
              days={model.days}
              onSelect={setSelectedId}
            />
          ))}
        </div>

        {/* Grade label column */}
        <div style={{
          borderInlineStart: "1px solid var(--sg-hairline)",
          background: "var(--sg-surface-2)",
          display: "grid",
          gridTemplateRows: model.rows.map(() => `${ROW_H}px`).join(" "),
        }}>
          {model.rows.map((row) => (
            <div key={row.grade} style={{
              display: "flex", flexDirection: "column", justifyContent: "center",
              padding: "0 14px",
              borderBottom: "1px solid var(--sg-hairline-2)",
            }}>
              <div style={{
                fontFamily: "var(--sg-font-display)", fontSize: 24, fontWeight: 600, lineHeight: 1,
                color: "var(--sg-ink)",
              }}>
                {row.hebrewLabel}
              </div>
              <div style={{ fontFamily: "var(--sg-font-mono)", fontSize: 10, color: "var(--sg-ink-soft)", marginTop: 4 }}>
                {row.bars.length} אירועים
              </div>
            </div>
          ))}
        </div>
      </div>

      <EventDrawer event={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

/* ---- Day axis ---- */
function DayAxis({ days }: { days: WeeklyModel["days"] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      borderBottom: "1px solid var(--sg-hairline)",
      background: "var(--sg-surface-2)",
    }}>
      {days.map((d) => (
        <div key={d.dayIndex} style={{
          padding: "12px 16px 12px",
          borderInlineStart: "1px solid var(--sg-hairline-2)",
          background: d.isToday
            ? "var(--sg-accent-soft)"
            : d.isWeekend
              ? "color-mix(in oklch, var(--sg-bg-deep) 60%, white)"
              : "transparent",
          display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{
              fontFamily: "var(--sg-font-display)", fontSize: 28, fontWeight: 700, lineHeight: 1,
              color: d.isToday ? "var(--sg-accent-ink)" : d.isWeekend ? "var(--sg-ink-soft)" : "var(--sg-ink)",
            }}>
              {d.dayOfMonth}
            </span>
            <span style={{
              fontFamily: "var(--sg-font-display)", fontSize: 15, fontWeight: 500,
              color: d.isToday ? "var(--sg-accent-ink)" : d.isWeekend ? "var(--sg-ink-soft)" : "var(--sg-ink-mute)",
            }}>
              {d.hebrewName}
            </span>
          </div>
          <div style={{
            fontFamily: "var(--sg-font-mono)", fontSize: 10, letterSpacing: "0.06em",
            color: d.isToday ? "var(--sg-accent)" : "var(--sg-ink-soft)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{d.monoName}</span>
            {d.isToday && (
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--sg-accent)", textTransform: "uppercase" }}>
                היום
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Today line ---- */
function TodayLine({ dayIndex }: { dayIndex: number }) {
  // Position at the center of the today column
  const pct = ((dayIndex + 0.5) / 7) * 100;
  return (
    <div style={{
      position: "absolute",
      insetInlineStart: `${pct}%`,
      top: 0, bottom: 0,
      borderInlineEnd: "2px solid var(--sg-accent)",
      zIndex: 5,
      pointerEvents: "none",
    }}>
      <div style={{
        position: "absolute", top: -20, insetInlineEnd: -32,
        background: "var(--sg-accent)", color: "white",
        fontFamily: "var(--sg-font-mono)", fontSize: 10, fontWeight: 700,
        padding: "2px 8px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap",
      }}>
        היום
      </div>
    </div>
  );
}

/* ---- Grade row ---- */
interface GradeRowProps {
  row: WeeklyModel["rows"][number];
  days: WeeklyModel["days"];
  onSelect: (id: string) => void;
}

function GradeRow({ row, days, onSelect }: GradeRowProps) {
  return (
    <div style={{
      height: ROW_H, position: "relative",
      borderBottom: "1px solid var(--sg-hairline-2)",
    }}>
      {/* Day column dividers */}
      <div style={{
        position: "absolute", inset: 0,
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
      }}>
        {days.map((d) => (
          <div key={d.dayIndex} style={{
            borderInlineStart: "1px solid var(--sg-hairline-2)",
            background: d.isWeekend
              ? "repeating-linear-gradient(135deg, transparent 0 8px, color-mix(in oklch, var(--sg-bg-deep) 80%, transparent) 8px 9px)"
              : "transparent",
          }} />
        ))}
      </div>

      {/* Event bars */}
      <div style={{ position: "absolute", inset: 0 }}>
        {row.bars.map((bar) => (
          <EventBarChip
            key={bar.id}
            bar={bar}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

/* ---- Event bar chip ---- */
function EventBarChip({ bar, onSelect }: { bar: WeeklyEventBar; onSelect: (id: string) => void }) {
  const isVacation = bar.eventTypeKey === "vacation" || bar.eventTypeKey === "bagrut";
  const isPending = bar.status === "pending";
  const isDraft = bar.status === "draft";

  return (
    <button
      type="button"
      onClick={() => onSelect(bar.eventId)}
      title={bar.title}
      aria-label={bar.title}
      style={{
        position: "absolute",
        insetInlineStart: `${bar.startPct}%`,
        width: `${bar.widthPct}%`,
        minWidth: 48,
        top: ROW_PAD + bar.lane * (LANE_H + LANE_GAP),
        height: LANE_H,
        background: isDraft
          ? "transparent"
          : isVacation
            ? bar.eventTypeColor
            : `color-mix(in oklch, ${bar.eventTypeColor} 18%, white)`,
        color: isDraft ? bar.eventTypeColor : isVacation ? "white" : "var(--sg-ink)",
        border: isDraft
          ? `1.5px dashed ${bar.eventTypeColor}`
          : isPending
            ? `1px dashed ${bar.eventTypeColor}`
            : `none`,
        borderInlineEnd: isDraft || isPending ? undefined : `3px solid ${bar.eventTypeColor}`,
        borderRadius: 5,
        padding: "0 8px 0 10px",
        fontSize: 12, fontWeight: 500,
        display: "flex", alignItems: "center", gap: 6,
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "start",
        zIndex: 2,
      }}
    >
      <span style={{ width: 12, height: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <EventTypeGlyph glyph={bar.eventTypeGlyph} color={isVacation ? "rgba(255,255,255,0.85)" : bar.eventTypeColor} />
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {bar.title}
      </span>
    </button>
  );
}

/* ---- Week nav bar ---- */
interface WeekNavProps {
  model: WeeklyModel;
  onPrev: () => void;
  onNext: () => void;
}

function WeekNav({ model, onPrev, onNext }: WeekNavProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 24px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <h1 style={{
          fontFamily: "var(--sg-font-display)", fontSize: 26, fontWeight: 600,
          color: "var(--sg-ink)", margin: 0,
        }}>
          שבוע {model.weekLabel}
        </h1>
      </div>
      <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <NavBtn onClick={onPrev} aria-label="שבוע קודם">›</NavBtn>
        <NavBtn onClick={onNext} aria-label="שבוע הבא">‹</NavBtn>
        <div style={{ width: 1, height: 22, background: "var(--sg-hairline)", margin: "0 4px" }} />
        <PrintBtn />
      </div>
    </div>
  );
}

function NavBtn({ onClick, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: 32, minWidth: 36,
        borderRadius: 8, border: "1px solid var(--sg-hairline)",
        background: "var(--sg-surface)", color: "var(--sg-ink-mute)",
        fontSize: 16, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function PrintBtn() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 32, padding: "0 14px",
        borderRadius: 8, border: "1px solid var(--sg-hairline)",
        background: "var(--sg-surface)", color: "var(--sg-ink-mute)",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
      }}
    >
      ייצוא
    </button>
  );
}

/* ---- Glyph helper (emoji fallback) ---- */
const GLYPH_EMOJI: Record<string, string> = {
  book: "📚", party: "🎉", pencil: "✏️", mountain: "⛰️", compass: "🧭",
  flag: "🚩", sun: "☀️", users: "👥", cap: "🎓", heart: "💙", tag: "🏷️",
};

function EventTypeGlyph({ glyph, color }: { glyph: string; color: string }) {
  const emoji = GLYPH_EMOJI[glyph];
  if (emoji) return <span style={{ fontSize: 11 }}>{emoji}</span>;
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />;
}
