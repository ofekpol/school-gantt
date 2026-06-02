"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarMonth } from "@/lib/views/calendar";
import { readableTextColor } from "@/lib/colors";
import { findCurrentMonthStart } from "@/lib/views/current-period";

interface Props {
  months: CalendarMonth[];
  yearLabel: string;
  schoolName: string;
  onDayClick?: (isoDate: string) => void;
  onEventClick?: (eventId: string) => void;
}

/**
 * Renders one month at a time. Day cells show truncated event chips colored by
 * event type. Monochrome fallback uses the event-type glyph + dashed border so
 * chips remain distinguishable when printed in black-and-white.
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
  const tv = useTranslations("calendar");
  const currentMonthStart = findCurrentMonthStart(
    months.map((month, index) => ({
      startDate: `${month.year}-${String(month.monthIndex).padStart(2, "0")}-01`,
      monthIndex: month.monthIndex,
      leftPct: index,
      widthPct: 1,
    })),
  );
  const [selectedIndex, setSelectedIndex] = useState(() =>
    initialMonthIndex(months, currentMonthStart),
  );
  const currentMonthIndex = currentMonthStart
    ? months.findIndex(
        (item) => `${item.year}-${String(item.monthIndex).padStart(2, "0")}-01` === currentMonthStart,
      )
    : -1;

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(months.length - 1, 0)));
  }, [months.length]);

  const month = months[selectedIndex];

  if (!month) return null;

  return (
    <div className="year-calendar p-4">
      <section
        className="calendar-month rounded-md border border-neutral-200 bg-white p-2 sm:p-4 print:border-0 print:rounded-none"
        aria-label={`${tm(String(month.monthIndex) as `${number}`)} ${month.year}`}
      >
        <header className="mb-3 flex items-center justify-center gap-2 print:mb-2">
          <PeriodButton
            label={tv("previousMonth")}
            disabled={selectedIndex === 0}
            onClick={() => setSelectedIndex((index) => Math.max(index - 1, 0))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </PeriodButton>
          <div className="min-w-36 text-center">
            <h2 className="text-lg font-bold">
              {tm(String(month.monthIndex) as `${number}`)} {month.year}
            </h2>
            <p className="hidden print:block text-xs text-neutral-500">
              {schoolName} · {yearLabel}
            </p>
          </div>
          <PeriodButton
            label={tv("nextMonth")}
            disabled={selectedIndex === months.length - 1}
            onClick={() => setSelectedIndex((index) => Math.min(index + 1, months.length - 1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </PeriodButton>
          <TodayButton
            label={tv("backToToday")}
            disabled={currentMonthIndex < 0}
            onClick={() => {
              if (currentMonthIndex >= 0) setSelectedIndex(currentMonthIndex);
            }}
          />
        </header>
        <div className="mb-1 grid grid-cols-7 gap-px text-center text-xs font-medium text-neutral-500">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="py-1">
              {tw(`short_${i}` as `short_${0 | 1 | 2 | 3 | 4 | 5 | 6}`)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-neutral-200">
          {month.weeks.flatMap((w, wi) =>
            w.days.map((day, di) => (
              <div
                key={`${wi}-${di}`}
                className="calendar-day relative min-h-[64px] bg-white p-0.5 align-top sm:min-h-[88px] sm:p-1"
              >
                {day && (
                  <>
                    {onDayClick && (
                      <button
                        type="button"
                        aria-label={tv("newEventOnDate", { date: day.date })}
                        onClick={() => onDayClick(day.date)}
                        className="absolute inset-0 z-0 bg-transparent hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300"
                      />
                    )}
                    <div className="pointer-events-none relative z-10 mb-0.5 text-[11px] font-medium text-neutral-700">
                      {day.dayOfMonth}
                    </div>
                    <ul className="relative z-10 space-y-0.5">
                      {day.events.slice(0, 4).map((chip) => (
                        <li
                          key={chip.id}
                          title={eventTitle(chip.title, chip.isCanceled, chip.isUpdated, tv)}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEventClick?.(chip.eventId);
                            }}
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
                                {chip.isCanceled ? tv("canceled") : tv("updated")}
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
    </div>
  );
}

function TodayButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
    >
      <CalendarClock className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function PeriodButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
    >
      {children}
    </button>
  );
}

function initialMonthIndex(months: CalendarMonth[], currentMonthStart: string | null): number {
  if (!currentMonthStart) return 0;
  const index = months.findIndex(
    (month) => `${month.year}-${String(month.monthIndex).padStart(2, "0")}-01` === currentMonthStart,
  );
  return index >= 0 ? index : 0;
}

function eventTitle(
  title: string,
  isCanceled: boolean | undefined,
  isUpdated: boolean | undefined,
  t: ReturnType<typeof useTranslations<"calendar">>,
): string {
  if (isCanceled) return `${t("canceled")} · ${title}`;
  if (isUpdated) return `${t("updated")} · ${title}`;
  return title;
}
