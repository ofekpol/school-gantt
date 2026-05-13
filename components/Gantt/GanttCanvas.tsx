"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { AgendaItem } from "@/lib/views/agenda";
import type { GanttBar, GanttMonth, ZoomLevel } from "@/lib/views/gantt";
import { zoomScale } from "@/lib/views/gantt";
import { EventDrawer } from "./EventDrawer";

const ROW_HEIGHT_PX = 56;
const HEADER_HEIGHT_PX = 32;
const GRADE_COLUMN_PX = 64;

interface SerializedAgendaItem
  extends Omit<AgendaItem, "startAt" | "endAt"> {
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

/**
 * Horizontal Gantt: sticky grade column on the right (RTL), scrollable
 * timeline track on the left. Bars are absolute-positioned within the track
 * using the server-computed percentages — no client layout pass at first
 * paint.
 *
 * Multi-grade events are emitted as a single bar with rowSpan > 1; bars use
 * `top: rowStart*ROW_HEIGHT` and `height: rowSpan*ROW_HEIGHT`.
 */
export function GanttCanvas({
  events,
  bars,
  months,
  grades,
  zoom,
  emptyLabel,
}: Props) {
  const tm = useTranslations("months");
  const tg = useTranslations("gantt");
  const scale = zoomScale(zoom);
  const trackWidthPct = scale * 100;

  // Hydrate startAt/endAt back into Dates for the drawer.
  const eventMap = useMemo(() => {
    const m = new Map<string, AgendaItem>();
    for (const e of events) {
      m.set(e.id, {
        ...e,
        startAt: new Date(e.startAt),
        endAt: new Date(e.endAt),
      });
    }
    return m;
  }, [events]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? eventMap.get(selectedId) ?? null : null;

  if (bars.length === 0) {
    return (
      <p className="p-8 text-center text-neutral-500">{emptyLabel}</p>
    );
  }

  return (
    <div className="relative">
      <div
        className="relative overflow-x-auto"
        style={{
          paddingInlineEnd: `${GRADE_COLUMN_PX}px`,
        }}
      >
        <div
          className="relative"
          style={{
            width: `${trackWidthPct}%`,
            minWidth: "100%",
            height: `${HEADER_HEIGHT_PX + grades.length * ROW_HEIGHT_PX}px`,
          }}
        >
          {/* Month axis */}
          <div
            className="absolute inset-x-0 top-0 border-b border-neutral-200 bg-white"
            style={{ height: `${HEADER_HEIGHT_PX}px` }}
          >
            {months.map((m) => (
              <div
                key={m.startDate}
                className="absolute top-0 border-s border-neutral-100 text-[11px] text-neutral-500"
                style={{
                  insetInlineStart: `${m.leftPct}%`,
                  width: `${m.widthPct}%`,
                  height: `${HEADER_HEIGHT_PX}px`,
                  paddingInlineStart: "0.25rem",
                  lineHeight: `${HEADER_HEIGHT_PX}px`,
                }}
              >
                {tm(`short_${m.monthIndex}` as `short_${number}`)}
              </div>
            ))}
          </div>

          {/* Row backgrounds + dividers */}
          {grades.map((_, i) => (
            <div
              key={i}
              className={`absolute inset-x-0 border-t border-neutral-100 ${
                i % 2 === 0 ? "bg-white" : "bg-neutral-50"
              }`}
              style={{
                top: `${HEADER_HEIGHT_PX + i * ROW_HEIGHT_PX}px`,
                height: `${ROW_HEIGHT_PX}px`,
              }}
            />
          ))}

          {/* Bars */}
          {bars.map((bar) => (
            <button
              key={bar.id}
              type="button"
              onClick={() => setSelectedId(bar.eventId)}
              aria-label={bar.title}
              className="absolute rounded-md border border-black/10 px-2 py-1 text-start text-xs text-white shadow-sm hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
              style={{
                top: `${HEADER_HEIGHT_PX + bar.rowStart * ROW_HEIGHT_PX + 6}px`,
                height: `${bar.rowSpan * ROW_HEIGHT_PX - 12}px`,
                insetInlineStart: `${bar.leftPct}%`,
                width: `${bar.widthPct}%`,
                backgroundColor: bar.eventTypeColor,
                minWidth: "12px",
              }}
            >
              <span className="flex items-center gap-1 truncate">
                <span aria-hidden="true" className="text-[10px]">
                  {bar.eventTypeGlyph}
                </span>
                <span className="truncate">{bar.title}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sticky grade column (right side in RTL = inset-inline-end) */}
      <aside
        aria-label={tg("gradesColumnLabel")}
        className="absolute top-0 bottom-0 bg-white border-s border-neutral-200"
        style={{
          insetInlineEnd: 0,
          width: `${GRADE_COLUMN_PX}px`,
        }}
      >
        <div
          style={{ height: `${HEADER_HEIGHT_PX}px` }}
          className="border-b border-neutral-200"
        />
        {grades.map((g, i) => (
          <div
            key={g}
            className={`flex items-center justify-center text-sm font-medium border-t border-neutral-100 ${
              i % 2 === 0 ? "bg-white" : "bg-neutral-50"
            }`}
            style={{ height: `${ROW_HEIGHT_PX}px` }}
          >
            {g}
          </div>
        ))}
      </aside>

      <EventDrawer event={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
