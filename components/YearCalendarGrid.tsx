"use client";

import { useTranslations } from "next-intl";
import type { CalendarMonth } from "@/lib/views/calendar";
import { readableTextColor } from "@/lib/colors";

interface Props {
  months: CalendarMonth[];
  yearLabel: string;
  schoolName: string;
  onDayClick?: (isoDate: string) => void;
  onEventClick?: (eventId: string) => void;
}

/**
 * Renders one printable page per month. Day cells show truncated event chips
 * colored by event type. The print stylesheet adds page breaks between
 * months and adjusts cell size for A4 / A3. Monochrome fallback uses the
 * event-type glyph + dashed border so chips remain distinguishable when
 * printed in black-and-white.
 */
export function YearCalendarGrid({
  months,
  yearLabel,
  schoolName,
  onDayClick,
  onEventClick,
}: Props) {
  const tm = useTranslations("months");
  const tw = useTranslations("weekdays");
  const tc = useTranslations("common");

  return (
    <div className="year-calendar p-4">
      {months.map((m) => (
        <section
          key={`${m.year}-${m.monthIndex}`}
          className="calendar-month bg-white rounded-md border border-neutral-200 p-4 mb-6 print:mb-0 print:border-0 print:rounded-none"
          aria-label={`${tm(String(m.monthIndex) as `${number}`)} ${m.year}`}
        >
          <header className="flex items-baseline justify-between mb-3 print:mb-2">
            <h2 className="text-lg font-bold">
              {tm(String(m.monthIndex) as `${number}`)} {m.year}
            </h2>
            <p className="hidden print:block text-xs text-neutral-500">
              {schoolName} · {yearLabel}
            </p>
          </header>
          <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-neutral-500 mb-1">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="py-1">
                {tw(`short_${i}` as `short_${0 | 1 | 2 | 3 | 4 | 5 | 6}`)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-neutral-200">
            {m.weeks.flatMap((w, wi) =>
              w.days.map((day, di) => (
                <div
                  key={`${wi}-${di}`}
                  className="calendar-day bg-white min-h-[88px] p-1 align-top"
                >
                  {day && (
                    <>
                      {onDayClick ? (
                        <button
                          type="button"
                          onClick={() => onDayClick(day.date)}
                          aria-label={`אירוע חדש ב-${day.date}`}
                          className="text-[11px] font-medium text-neutral-700 mb-0.5 hover:text-blue-600 cursor-pointer w-full text-start"
                        >
                          {day.dayOfMonth}
                        </button>
                      ) : (
                        <div className="text-[11px] font-medium text-neutral-700 mb-0.5">
                          {day.dayOfMonth}
                        </div>
                      )}
                      <ul className="space-y-0.5">
                        {day.events.slice(0, 4).map((chip) => (
                          <li
                            key={chip.id}
                            title={chip.isCanceled ? `מבוטל · ${chip.title}` : chip.isUpdated ? `עודכן · ${chip.title}` : chip.title}
                          >
                            <button
                              type="button"
                              onClick={() => onEventClick?.(chip.eventId)}
                              disabled={!onEventClick}
                              className="event-chip flex w-full items-center gap-1 truncate rounded-sm border border-black/10 px-1 py-0.5 text-start text-[10px] disabled:cursor-default"
                              style={{
                                backgroundColor: chip.isCanceled ? "#fee2e2" : chip.eventTypeColor,
                                color: chip.isCanceled ? "#991b1b" : readableTextColor(chip.eventTypeColor),
                                textDecoration: chip.isCanceled ? "line-through" : "none",
                              }}
                            >
                              <span aria-hidden="true" className="event-chip-glyph">
                                {chip.eventTypeGlyph}
                              </span>
                              <span className="truncate">{chip.title}</span>
                              {(chip.isCanceled || chip.isUpdated) && (
                                <span className="shrink-0 rounded-full bg-white/70 px-1 text-[8px] font-bold">
                                  {chip.isCanceled ? "בוטל" : "עודכן"}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                        {day.events.length > 4 && (
                          <li className="text-[9px] text-neutral-500">
                            {tc("more", { count: day.events.length - 4 })}
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              )),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
