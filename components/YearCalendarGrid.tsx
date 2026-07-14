"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarMonth } from "@/lib/views/calendar";
import { readableTextColor } from "@/lib/colors";
import { findCurrentMonthStart, jerusalemDateKey } from "@/lib/views/current-period";

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
  const todayKey = jerusalemDateKey(new Date());
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
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const selectedMonthOptionRef = useRef<HTMLButtonElement | null>(null);
  const currentMonthIndex = currentMonthStart
    ? months.findIndex(
        (item) => `${item.year}-${String(item.monthIndex).padStart(2, "0")}-01` === currentMonthStart,
      )
    : -1;

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(months.length - 1, 0)));
  }, [months.length]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    selectedMonthOptionRef.current?.scrollIntoView({ block: "start" });
  }, [monthPickerOpen, selectedIndex]);

  const month = months[selectedIndex];
  const monthLabel = `${tm(String(month?.monthIndex ?? 1) as `${number}`)} ${month?.year ?? ""}`.trim();

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
          <div className="relative min-w-36 text-center">
            <h2 className="text-lg font-bold">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={monthPickerOpen}
                onClick={() => setMonthPickerOpen((open) => !open)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-300 print:pointer-events-none"
              >
                <span>{monthLabel}</span>
                <ChevronDown className="size-4 text-neutral-500 print:hidden" aria-hidden="true" />
              </button>
            </h2>
            {monthPickerOpen && (
              <div className="absolute left-1/2 z-30 mt-2 max-h-72 w-52 -translate-x-1/2 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1 text-start shadow-xl print:hidden">
                <div role="listbox" aria-label={tv("chooseMonth")} className="space-y-0.5">
                  {months.map((item, index) => {
                    const label = `${tm(String(item.monthIndex) as `${number}`)} ${item.year}`;
                    const selected = index === selectedIndex;
                    return (
                      <button
                        key={`${item.year}-${item.monthIndex}`}
                        ref={selected ? selectedMonthOptionRef : null}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setSelectedIndex(index);
                          setMonthPickerOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm transition-colors ${
                          selected
                            ? "bg-blue-600 font-semibold text-white"
                            : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
            w.days.map((day, di) => {
              if (!day) {
                return (
                  <div
                    key={`${wi}-${di}`}
                    className="calendar-day relative min-h-[64px] bg-[var(--sg-surface)] p-0.5 align-top sm:min-h-[88px] sm:p-1"
                  />
                );
              }

              return (
              <div
                key={`${wi}-${di}`}
                aria-current={day.date === todayKey ? "date" : undefined}
                data-date-status={day.dateStatus}
                data-outside-month={day.inMonth ? undefined : "true"}
                style={day.closureColor ? { "--closure-color": day.closureColor } as React.CSSProperties : undefined}
                className={`calendar-day relative min-h-[64px] bg-[var(--sg-surface)] p-0.5 align-top sm:min-h-[88px] sm:p-1 ${
                  day.date === todayKey ? "ring-2 ring-inset ring-blue-500" : ""
                }`}
              >
                {onDayClick && (
                  <button
                    type="button"
                    aria-label={tv("newEventOnDate", { date: day.date })}
                    onClick={() => onDayClick(day.date)}
                    className="absolute inset-0 z-0 bg-transparent hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300"
                  />
                )}
                <div
                  className={`pointer-events-none relative z-10 mb-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium ${
                    day.date === todayKey
                      ? "bg-blue-600 text-white"
                      : day.inMonth
                        ? "text-neutral-700"
                        : "text-neutral-400"
                  }`}
                >
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
              </div>
              );
            }),
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
