"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { AgendaItem } from "@/lib/views/agenda";
import type { GanttBar, GanttMonth, ZoomLevel } from "@/lib/views/gantt";
import { zoomScale } from "@/lib/views/gantt";
import { formatGradeLabel } from "@/lib/grades";
import { EventDrawer } from "./EventDrawer";

const ROW_HEIGHT_PX = 72;
const HEADER_HEIGHT_PX = 48;
const GRADE_COLUMN_PX = 80;

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

  const eventMap = useMemo(() => {
    const m = new Map<string, AgendaItem>();
    for (const e of events) {
      m.set(e.id, { ...e, startAt: new Date(e.startAt), endAt: new Date(e.endAt) });
    }
    return m;
  }, [events]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (eventMap.get(selectedId) ?? null) : null;

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
                <div key={m.startDate} style={{
                  position: "absolute",
                  top: 0, bottom: 0,
                  insetInlineStart: `${m.leftPct}%`,
                  width: `${m.widthPct}%`,
                  borderInlineStart: "1px solid var(--sg-hairline-2)",
                  display: "flex", flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "0 12px 8px",
                }}>
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

          {/* Event bars */}
          {bars.map((bar) => (
            <EventBarButton key={bar.id} bar={bar} onSelect={setSelectedId} />
          ))}
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

interface EventBarButtonProps {
  bar: GanttBar;
  onSelect: (id: string) => void;
}

function EventBarButton({ bar, onSelect }: EventBarButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(bar.eventId)}
      aria-label={bar.title}
      style={{
        position: "absolute",
        top: HEADER_HEIGHT_PX + bar.rowStart * ROW_HEIGHT_PX + 8,
        height: bar.rowSpan * ROW_HEIGHT_PX - 16,
        insetInlineStart: `${bar.leftPct}%`,
        width: `max(${bar.widthPct}%, 12px)`,
        background: `color-mix(in oklch, ${bar.eventTypeColor} 18%, white)`,
        borderInlineEnd: `3px solid ${bar.eventTypeColor}`,
        borderRadius: 5,
        padding: "0 8px 0 10px",
        fontSize: 12, fontWeight: 500,
        display: "flex", alignItems: "center", gap: 6,
        overflow: "hidden",
        cursor: "pointer", textAlign: "start",
        color: "var(--sg-ink)",
        border: "none",
      }}
    >
      <span style={{ fontSize: 11, flexShrink: 0 }}>{bar.eventTypeGlyph}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {bar.title}
      </span>
    </button>
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
