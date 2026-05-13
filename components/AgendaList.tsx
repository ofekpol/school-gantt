"use client";

import { useState } from "react";
import type { AgendaItem } from "@/lib/views/agenda";

interface SerializedAgendaItem extends Omit<AgendaItem, "startAt" | "endAt"> {
  startAt: Date | string;
  endAt: Date | string;
}

interface SerializedAgendaWeek {
  weekStart: string;
  items: SerializedAgendaItem[];
}

interface Props {
  weeks: SerializedAgendaWeek[];
  emptyLabel: string;
}

const weekHeaderFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "numeric",
  month: "short",
});

const dayFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Week-grouped vertical agenda — public mobile view.
 * Tap a row to expand its description/location. 44 px tap targets per WCAG +
 * Lighthouse mobile a11y.
 */
export function AgendaList({ weeks, emptyLabel }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (weeks.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-neutral-500">{emptyLabel}</p>
    );
  }

  return (
    <div className="px-4 pt-4 space-y-6">
      {weeks.map((week) => (
        <section key={week.weekStart} aria-labelledby={`week-${week.weekStart}`}>
          <h2
            id={`week-${week.weekStart}`}
            className="text-sm font-semibold text-neutral-500 mb-2 sticky top-[57px] bg-neutral-50 py-1 z-[5]"
          >
            {weekHeaderFmt.format(new Date(`${week.weekStart}T00:00:00+03:00`))}
            {" – "}
            {weekHeaderFmt.format(
              new Date(addDays(week.weekStart, 6) + "T00:00:00+03:00"),
            )}
          </h2>
          <ul className="space-y-2">
            {week.items.map((item) => {
              const expanded = expandedId === item.id;
              const startDate = new Date(item.startAt);
              const endDate = new Date(item.endAt);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : item.id)
                    }
                    aria-expanded={expanded}
                    aria-controls={`event-detail-${item.id}`}
                    className="w-full min-h-[44px] flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-start hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 inline-flex size-3 shrink-0 items-center justify-center rounded-full border border-neutral-300"
                      style={{ backgroundColor: item.eventTypeColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-neutral-500">
                        {dayFmt.format(startDate)}
                        {!item.allDay && (
                          <>
                            {" · "}
                            {timeFmt.format(startDate)}
                            {" – "}
                            {timeFmt.format(endDate)}
                          </>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <span
                            aria-hidden="true"
                            className="text-xs"
                          >
                            {item.eventTypeGlyph}
                          </span>
                          {item.eventTypeLabelHe}
                        </span>
                        {item.grades.length > 0 && (
                          <span className="ms-2">
                            · {item.grades.join(", ")}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                  {expanded && (
                    <div
                      id={`event-detail-${item.id}`}
                      className="mt-1 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-700 space-y-2"
                    >
                      {item.location && (
                        <p>
                          <span className="font-medium">מיקום:</span>{" "}
                          {item.location}
                        </p>
                      )}
                      {item.description && (
                        <p className="whitespace-pre-wrap">{item.description}</p>
                      )}
                      {!item.location && !item.description && (
                        <p className="text-neutral-400">אין פרטים נוספים.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
