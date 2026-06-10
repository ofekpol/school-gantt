"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  buildWeeklyModel,
  type WeeklyModel,
  type WeeklyEventBar,
} from "@/lib/views/gantt-weekly";
import { Ban, Pencil } from "lucide-react";
import { EventDrawer } from "./EventDrawer";
import { useRouteProgress } from "@/components/RouteProgress";
import { ExportToGoogleCalendarButton } from "@/components/ExportToGoogleCalendarButton";

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
  eventTypeId?: string;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  status?: "approved" | "canceled";
  isCanceled?: boolean;
  isUpdated?: boolean;
  grades: number[];
}

interface Props {
  model: WeeklyModel;
  events: SerializedEvent[];
  onDayClick?: (isoDate: string) => void;
  onEventClick?: (eventId: string) => void;
  navigationMode?: "router" | "local";
}

export function GanttWeekly({
  model,
  events,
  onDayClick,
  onEventClick,
  navigationMode = "router",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const startRouteProgress = useRouteProgress();
  const [displayWeekStartMs, setDisplayWeekStartMs] = useState(() => model.weekStart.getTime());

  useEffect(() => {
    setDisplayWeekStartMs(model.weekStart.getTime());
  }, [model.weekStart]);

  const hydratedEvents = useMemo(
    () => events.map((e) => ({
      ...e,
      startAt: new Date(e.startAt),
      endAt: new Date(e.endAt),
      status: e.status ?? "approved",
      isCanceled: e.isCanceled ?? false,
      isUpdated: e.isUpdated ?? false,
    })),
    [events],
  );

  const eventMap = useMemo(
    () => new Map(hydratedEvents.map((e) => [e.id, e])),
    [hydratedEvents],
  );

  const displayModel = useMemo(() => {
    if (displayWeekStartMs === model.weekStart.getTime()) return model;
    return buildWeeklyModel(
      new Date(displayWeekStartMs),
      hydratedEvents,
      model.rows.map((row) => row.grade),
      new Date(),
    );
  }, [displayWeekStartMs, hydratedEvents, model]);

  const selected = selectedId ? (eventMap.get(selectedId) ?? null) : null;

  function selectEvent(eventId: string) {
    if (onEventClick) {
      onEventClick(eventId);
      return;
    }
    setSelectedId(eventId);
  }

  function navigate(delta: number) {
    const next = new Date(displayModel.weekStart.getTime() + delta * 7 * 24 * 60 * 60 * 1000);
    const iso = next.toISOString().slice(0, 10);
    const params =
      navigationMode === "local"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams(searchParams.toString());
    params.set("week", iso);
    setDisplayWeekStartMs(next.getTime());
    if (navigationMode === "local") {
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
      return;
    }
    startRouteProgress();
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
    });
  }

  const todayIndex = displayModel.days.findIndex((d) => d.isToday);

  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: "var(--sg-font-ui)" }}>
      {/* Week navigation */}
      <WeekNav model={displayModel} onPrev={() => navigate(-1)} onNext={() => navigate(1)} />

      {/* Gantt body — scrollable horizontally on narrow screens */}
      <div className="overflow-x-auto px-2 pb-1 sm:px-6 sm:pb-0">
      <div style={{
        marginBottom: 16,
        minWidth: 480,
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
        <DayAxis days={displayModel.days} onDayClick={onDayClick} />

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
          {displayModel.rows.map((row) => (
            <GradeRow
              key={row.grade}
              row={row}
              days={displayModel.days}
              onSelect={selectEvent}
              onDayClick={onDayClick}
            />
          ))}
        </div>

        {/* Grade label column */}
        <div style={{
          borderInlineStart: "1px solid var(--sg-hairline)",
          background: "var(--sg-surface-2)",
          display: "grid",
          gridTemplateRows: displayModel.rows.map(() => `${ROW_H}px`).join(" "),
        }}>
          {displayModel.rows.map((row) => (
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
      </div>{/* end overflow-x-auto scroll wrapper */}

      {!onEventClick && <EventDrawer event={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

/* ---- Day axis ---- */
function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DayAxis({ days, onDayClick }: { days: WeeklyModel["days"]; onDayClick?: (isoDate: string) => void }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      borderBottom: "1px solid var(--sg-hairline)",
      background: "var(--sg-surface-2)",
    }}>
      {days.map((d) => (
        <button
          key={d.dayIndex}
          type="button"
          onClick={() => onDayClick?.(isoDate(d.date))}
          disabled={!onDayClick}
          style={{
          padding: "12px 16px 12px",
          borderInlineStart: "1px solid var(--sg-hairline-2)",
          borderTop: "none", borderBottom: "none", borderInlineEnd: "none",
          background: d.isToday
            ? "var(--sg-accent-soft)"
            : d.isWeekend
              ? "color-mix(in oklch, var(--sg-bg-deep) 60%, white)"
              : "transparent",
          display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2,
          textAlign: "start",
          cursor: onDayClick ? "pointer" : "default",
          font: "inherit",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{
              fontFamily: "var(--sg-font-display)", fontSize: 28, fontWeight: 700, lineHeight: 1,
              color: d.isToday ? "var(--sg-accent-ink)" : d.isWeekend ? "var(--sg-ink-mute)" : "var(--sg-ink)",
            }}>
              {d.dayOfMonth}
            </span>
            <span style={{
              fontFamily: "var(--sg-font-display)", fontSize: 15, fontWeight: 500,
              color: d.isToday ? "var(--sg-accent-ink)" : "var(--sg-ink-mute)",
            }}>
              {d.hebrewName}
            </span>
          </div>
          <div style={{
            fontFamily: "var(--sg-font-mono)", fontSize: 10, letterSpacing: "0.06em",
            color: d.isToday ? "var(--sg-accent)" : "var(--sg-ink-mute)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{d.monoName}</span>
            {d.isToday && (
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--sg-accent)", textTransform: "uppercase" }}>
                היום
              </span>
            )}
          </div>
        </button>
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
  onDayClick?: (isoDate: string) => void;
}

function GradeRow({ row, days, onSelect, onDayClick }: GradeRowProps) {
  const t = useTranslations("gantt");
  return (
    <div style={{
      height: ROW_H, position: "relative",
      borderBottom: "1px solid var(--sg-hairline-2)",
    }}>
      {/* Day column dividers — also catches clicks on empty day area */}
      <div style={{
        position: "absolute", inset: 0,
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
      }}>
        {days.map((d) => (
          <button
            key={d.dayIndex}
            type="button"
            onClick={onDayClick ? () => onDayClick(isoDate(d.date)) : undefined}
            disabled={!onDayClick}
            aria-label={
              onDayClick
                ? t("newEventOnDate", { date: isoDate(d.date) })
                : t("cellLabel", { date: isoDate(d.date), grade: row.grade })
            }
            style={{
              borderInlineStart: "1px solid var(--sg-hairline-2)",
              borderTop: "none", borderBottom: "none", borderInlineEnd: "none",
              background: d.isWeekend
                ? "repeating-linear-gradient(135deg, transparent 0 8px, color-mix(in oklch, var(--sg-bg-deep) 80%, transparent) 8px 9px)"
                : "transparent",
              cursor: onDayClick ? "pointer" : "default",
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Event bars */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
  const isCanceled = bar.status === "canceled" || bar.isCanceled;
  const label = isCanceled ? `מבוטל · ${bar.title}` : bar.isUpdated ? `עודכן · ${bar.title}` : bar.title;

  return (
    <button
      type="button"
      onClick={() => onSelect(bar.eventId)}
      title={label}
      aria-label={label}
      style={{
        position: "absolute",
        insetInlineStart: `${bar.startPct}%`,
        width: `${bar.widthPct}%`,
        minWidth: 76,
        top: ROW_PAD + bar.lane * (LANE_H + LANE_GAP),
        height: LANE_H,
        background: isCanceled
          ? "repeating-linear-gradient(135deg, #fee2e2 0 8px, #fecaca 8px 10px)"
          : isDraft
          ? "transparent"
          : isVacation
            ? bar.eventTypeColor
            : `color-mix(in oklch, ${bar.eventTypeColor} 18%, white)`,
        color: isCanceled ? "#991b1b" : isDraft ? bar.eventTypeColor : isVacation ? "white" : "var(--sg-ink)",
        border: isCanceled
          ? "1px solid #fca5a5"
          : isDraft
          ? `1.5px dashed ${bar.eventTypeColor}`
          : isPending
            ? `1px dashed ${bar.eventTypeColor}`
            : `none`,
        borderInlineEnd: isCanceled || isDraft || isPending ? undefined : `3px solid ${bar.eventTypeColor}`,
        borderRadius: 5,
        padding: "0 6px 0 8px",
        fontSize: 12, fontWeight: 500,
        display: "flex", alignItems: "center", gap: 4,
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "start",
        zIndex: 2,
        pointerEvents: "auto",
      }}
    >
      <span style={{ width: 12, height: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <EventTypeGlyph glyph={bar.eventTypeGlyph} color={isVacation ? "rgba(255,255,255,0.85)" : bar.eventTypeColor} />
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 auto", minWidth: 0, textDecoration: isCanceled ? "line-through" : "none" }}>
        {bar.title}
      </span>
      {(isCanceled || bar.isUpdated) && (
        <span style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          borderRadius: 999,
          background: isCanceled ? "#fecaca" : "#bfdbfe",
          color: isCanceled ? "#7f1d1d" : "#1e3a8a",
        }}>
          {isCanceled ? <Ban size={9} /> : <Pencil size={9} />}
        </span>
      )}
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
    <div className="flex items-center gap-3 px-3 py-3 sm:px-6" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <h1 style={{
          fontFamily: "var(--sg-font-display)", fontSize: 26, fontWeight: 600,
          color: "var(--sg-ink)", margin: 0,
        }}>
          שבוע {model.weekLabel}
        </h1>
      </div>
      <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <NavBtn onClick={onNext} aria-label="שבוע הבא">‹</NavBtn>
        <NavBtn onClick={onPrev} aria-label="שבוע קודם">›</NavBtn>
        <div style={{ width: 1, height: 22, background: "var(--sg-hairline)", margin: "0 4px" }} />
        <DashboardExportBtn />
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

function DashboardExportBtn() {
  return (
    <ExportToGoogleCalendarButton
      labelKey="shortButton"
      buttonClassName="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--sg-hairline)] bg-[var(--sg-surface)] px-3.5 text-[13px] font-medium text-[var(--sg-ink-mute)] transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    />
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
