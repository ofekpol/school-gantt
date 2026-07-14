"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, Pencil } from "lucide-react";
import type { AgendaItem } from "@/lib/views/agenda-model";
import type { GanttBar, GanttMonth, ZoomLevel } from "@/lib/views/gantt";
import { zoomScale } from "@/lib/views/gantt";
import { formatGradeLabel } from "@/lib/grades";
import { EventDrawer } from "./EventDrawer";
import { findCurrentMonthStart } from "@/lib/views/current-period";

const ROW_HEIGHT_PX = 72;
const HEADER_HEIGHT_PX = 48;
const GRADE_COLUMN_PX = 80;
const EVENT_BAR_Z_INDEX_BASE = 10;
const EVENT_BAR_Z_INDEX_MAX = 30;
const EVENT_BAR_ROW_PAD_PX = 8;
const EVENT_BAR_LANE_GAP_PX = 4;

const HE_MONTHS: Record<number, { label: string; mono: string }> = {
  1:  { label: "ינואר",  mono: "JAN" },
  2:  { label: "פברואר", mono: "FEB" },
  3:  { label: "מרץ",    mono: "MAR" },
  4:  { label: "אפריל",  mono: "APR" },
  5:  { label: "מאי",    mono: "MAY" },
  6:  { label: "יוני",   mono: "JUN" },
  7:  { label: "יולי",   mono: "JUL" },
  8:  { label: "אוגוסט", mono: "AUG" },
  9:  { label: "ספטמבר", mono: "SEP" },
  10: { label: "אוקטובר", mono: "OCT" },
  11: { label: "נובמבר", mono: "NOV" },
  12: { label: "דצמבר",  mono: "DEC" },
};

interface SerializedAgendaItem extends Omit<AgendaItem, "startAt" | "endAt"> {
  startAt: Date | string;
  endAt: Date | string;
}

interface Props {
  events: SerializedAgendaItem[];
  bars: GanttBar[];
  months: GanttMonth[];
  grades: number[];
  zoom: ZoomLevel;
  emptyLabel: string;
}

export function GanttCanvas({ events, bars, months, grades, zoom, emptyLabel }: Props) {
  const tg = useTranslations("gantt");
  const scale = zoomScale(zoom);
  const trackWidthPct = scale * 100;
  const monthRefs = useRef(new Map<string, HTMLDivElement>());
  const currentMonthStart = findCurrentMonthStart(months);

  const eventMap = useMemo(() => {
    const m = new Map<string, AgendaItem>();
    for (const e of events) {
      m.set(e.id, { ...e, startAt: new Date(e.startAt), endAt: new Date(e.endAt) });
    }
    return m;
  }, [events]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (eventMap.get(selectedId) ?? null) : null;
  const backgroundRanges = useMemo(
    () => buildBackgroundRanges(events, months, grades),
    [events, grades, months],
  );

  useEffect(() => {
    if (!currentMonthStart) return;
    monthRefs.current.get(currentMonthStart)?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "auto",
    });
  }, [currentMonthStart]);

  if (bars.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  return (
    <div style={{ position: "relative", fontFamily: "var(--sg-font-ui)" }}>
      <div
        style={{ position: "relative", overflowX: "auto", paddingInlineEnd: GRADE_COLUMN_PX }}
      >
        <div style={{
          position: "relative",
          width: `${trackWidthPct}%`,
          minWidth: "100%",
          height: HEADER_HEIGHT_PX + grades.length * ROW_HEIGHT_PX,
        }}>
          {/* Month axis */}
          <div style={{
            position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: 0,
            height: HEADER_HEIGHT_PX,
            borderBottom: "1px solid var(--sg-hairline)",
            background: "var(--sg-surface-2)",
          }}>
            {months.map((m) => {
              const info = HE_MONTHS[m.monthIndex];
              return (
                <div
                  key={m.startDate}
                  ref={(node) => {
                    if (node) monthRefs.current.set(m.startDate, node);
                    else monthRefs.current.delete(m.startDate);
                  }}
                  style={{
                    position: "absolute",
                    top: 0, bottom: 0,
                    insetInlineStart: `${m.leftPct}%`,
                    width: `${m.widthPct}%`,
                    borderInlineStart: "1px solid var(--sg-hairline-2)",
                    display: "flex", flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "0 12px 8px",
                  }}
                >
                  <span style={{
                    fontFamily: "var(--sg-font-display)", fontSize: 14, fontWeight: 600,
                    color: "var(--sg-ink)", display: "block",
                  }}>
                    {info?.label ?? m.monthIndex}
                  </span>
                  <span style={{
                    fontFamily: "var(--sg-font-mono)", fontSize: 10, color: "var(--sg-ink-soft)",
                    letterSpacing: "0.04em",
                  }}>
                    {info?.mono}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Row backgrounds */}
          {grades.map((_, i) => (
            <div key={i} style={{
              position: "absolute", insetInlineStart: 0, insetInlineEnd: 0,
              top: HEADER_HEIGHT_PX + i * ROW_HEIGHT_PX,
              height: ROW_HEIGHT_PX,
              borderBottom: "1px solid var(--sg-hairline-2)",
              background: i % 2 === 0 ? "var(--sg-surface)" : "var(--sg-surface-2)",
            }} />
          ))}

          {backgroundRanges.map((range) => (
            <div
              key={range.id}
              aria-hidden="true"
              data-date-status={range.status}
              style={{
                position: "absolute",
                insetInlineStart: `${range.leftPct}%`,
                top: HEADER_HEIGHT_PX + range.rowStart * ROW_HEIGHT_PX,
                width: `${range.widthPct}%`,
                height: range.rowSpan * ROW_HEIGHT_PX,
                background: range.color
                  ? `color-mix(in oklch, ${range.color} 16%, var(--sg-surface))`
                  : "var(--sg-weekend-bg)",
                boxShadow: range.color ? `inset 0 3px 0 ${range.color}` : undefined,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          ))}

          {/* Event bars — smaller area gets higher z so they're always clickable */}
          {bars.map((bar) => {
            const area = bar.widthPct * bar.rowSpan;
            const zIndex = Math.min(
              EVENT_BAR_Z_INDEX_MAX,
              EVENT_BAR_Z_INDEX_BASE + Math.round(10000 / Math.max(area, 0.01)),
            );
            return <EventBarButton key={bar.id} bar={bar} zIndex={zIndex} onSelect={setSelectedId} />;
          })}
        </div>
      </div>

      {/* Sticky grade column */}
      <aside
        aria-label={tg("gradesColumnLabel")}
        style={{
          position: "absolute", top: 0, bottom: 0,
          insetInlineEnd: 0,
          width: GRADE_COLUMN_PX,
          background: "var(--sg-surface-2)",
          borderInlineStart: "1px solid var(--sg-hairline)",
          zIndex: 20,
        }}
      >
        <div style={{
          height: HEADER_HEIGHT_PX,
          borderBottom: "1px solid var(--sg-hairline)",
          display: "flex", alignItems: "flex-end", padding: "0 14px 8px",
        }}>
          <span style={{ fontFamily: "var(--sg-font-display)", fontSize: 12, color: "var(--sg-ink-soft)" }}>
            שכבות
          </span>
        </div>
        {grades.map((g, i) => (
          <div key={g} style={{
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "0 14px",
            height: ROW_HEIGHT_PX,
            borderBottom: "1px solid var(--sg-hairline-2)",
            background: i % 2 === 0 ? "var(--sg-surface)" : "var(--sg-surface-2)",
          }}>
            <div style={{
              fontFamily: "var(--sg-font-display)", fontSize: 22, fontWeight: 600,
              lineHeight: 1, color: "var(--sg-ink)",
            }}>
              {formatGradeLabel(g)}
            </div>
            <div style={{
              fontFamily: "var(--sg-font-mono)", fontSize: 10, color: "var(--sg-ink-soft)", marginTop: 3,
            }}>
              שכבת {formatGradeLabel(g)}
            </div>
          </div>
        ))}
      </aside>

      <EventDrawer event={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

interface BackgroundRange {
  id: string;
  leftPct: number;
  widthPct: number;
  rowStart: number;
  rowSpan: number;
  status: "weekend" | "holiday" | "vacation";
  color?: string;
}

function buildBackgroundRanges(
  events: SerializedAgendaItem[],
  months: GanttMonth[],
  grades: number[],
): BackgroundRange[] {
  const first = months[0];
  const last = months.at(-1);
  if (!first || !last || grades.length === 0) return [];
  const start = new Date(`${first.startDate}T00:00:00Z`);
  const [lastYear, lastMonth] = last.startDate.split("-").map(Number);
  const end = new Date(Date.UTC(lastYear, lastMonth, 1));
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((end.getTime() - start.getTime()) / dayMs);
  const ranges: BackgroundRange[] = [];

  for (let day = 0; day < days; day++) {
    const date = new Date(start.getTime() + day * dayMs);
    if (date.getUTCDay() === 5 || date.getUTCDay() === 6) {
      ranges.push({ id: `weekend-${day}`, leftPct: (day / days) * 100, widthPct: 100 / days, rowStart: 0, rowSpan: grades.length, status: "weekend" });
    }
  }

  for (const event of events) {
    if (event.isCanceled || (event.eventTypeKey !== "holiday" && event.eventTypeKey !== "vacation")) continue;
    const eventStart = new Date(event.startAt).getTime();
    const eventEnd = new Date(event.endAt).getTime();
    const leftPct = Math.max(0, ((eventStart - start.getTime()) / (end.getTime() - start.getTime())) * 100);
    const rightPct = Math.min(100, ((eventEnd - start.getTime()) / (end.getTime() - start.getTime())) * 100);
    if (rightPct <= 0 || leftPct >= 100) continue;
    const matchingGrades = event.eventTypeKey === "holiday" ? grades : grades.filter((grade) => event.grades.includes(grade));
    for (const grade of matchingGrades) {
      ranges.push({
        id: `${event.id}-${grade}`,
        leftPct,
        widthPct: Math.max(rightPct - leftPct, 100 / days),
        rowStart: event.eventTypeKey === "holiday" ? 0 : grades.indexOf(grade),
        rowSpan: event.eventTypeKey === "holiday" ? grades.length : 1,
        status: event.eventTypeKey,
        color: event.eventTypeColor,
      });
      if (event.eventTypeKey === "holiday") break;
    }
  }
  return ranges;
}

interface EventBarButtonProps {
  bar: GanttBar;
  zIndex: number;
  onSelect: (id: string) => void;
}

function EventBarButton({ bar, zIndex, onSelect }: EventBarButtonProps) {
  const isCanceled = bar.status === "canceled" || bar.isCanceled;
  const label = isCanceled ? `מבוטל · ${bar.title}` : bar.isUpdated ? `עודכן · ${bar.title}` : bar.title;
  const laneCount = Math.max(bar.laneCount, 1);
  const laneHeight = Math.max(
    14,
    (ROW_HEIGHT_PX - EVENT_BAR_ROW_PAD_PX * 2 - (laneCount - 1) * EVENT_BAR_LANE_GAP_PX) /
      laneCount,
  );

  return (
    <>
      {Array.from({ length: bar.rowSpan }, (_, rowOffset) => (
        <button
          key={`${bar.id}-${rowOffset}`}
          type="button"
          onClick={() => onSelect(bar.eventId)}
          aria-label={label}
          title={label}
          style={{
            position: "absolute",
            top:
              HEADER_HEIGHT_PX +
              (bar.rowStart + rowOffset) * ROW_HEIGHT_PX +
              EVENT_BAR_ROW_PAD_PX +
              bar.lane * (laneHeight + EVENT_BAR_LANE_GAP_PX),
            height: laneHeight,
            insetInlineStart: `${bar.leftPct}%`,
            width: `max(${bar.widthPct}%, 12px)`,
            background: isCanceled
              ? "repeating-linear-gradient(135deg, #fee2e2 0 8px, #fecaca 8px 10px)"
              : `color-mix(in oklch, ${bar.eventTypeColor} 18%, white)`,
            borderInlineEnd: isCanceled ? undefined : `3px solid ${bar.eventTypeColor}`,
            borderRadius: 5,
            padding: "0 8px 0 10px",
            fontSize: laneHeight < 18 ? 10 : 12,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflow: "hidden",
            cursor: "pointer",
            textAlign: "start",
            color: isCanceled ? "#991b1b" : "var(--sg-ink)",
            border: isCanceled ? "1px solid #fca5a5" : "none",
            zIndex,
          }}
        >
          <span style={{ fontSize: 11, flexShrink: 0 }}>{bar.eventTypeGlyph}</span>
          <span
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: isCanceled ? "line-through" : "none",
            }}
          >
            {bar.title}
          </span>
          {(isCanceled || bar.isUpdated) && (
            <span
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 14,
                height: 14,
                borderRadius: 999,
                background: isCanceled ? "#fecaca" : "#bfdbfe",
                color: isCanceled ? "#7f1d1d" : "#1e3a8a",
              }}
            >
              {isCanceled ? <Ban size={9} /> : <Pencil size={9} />}
            </span>
          )}
        </button>
      ))}
    </>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{
      display: "grid", placeItems: "center",
      padding: "64px 24px",
      textAlign: "center",
      fontFamily: "var(--sg-font-ui)",
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: "50%",
        background: "var(--sg-bg-deep)",
        display: "grid", placeItems: "center",
        color: "var(--sg-ink-soft)", fontSize: 36,
        marginBottom: 20,
      }}>
        📅
      </div>
      <h2 style={{
        fontFamily: "var(--sg-font-display)", fontSize: 22, fontWeight: 600,
        color: "var(--sg-ink)", margin: "0 0 8px",
      }}>
        {label}
      </h2>
    </div>
  );
}
