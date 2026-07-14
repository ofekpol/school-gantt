"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { WeeklyEventBar, WeeklyModel } from "@/lib/views/gantt-weekly";

interface MobileWeekEvent {
  eventId: string;
  title: string;
  eventTypeKey: string;
  eventTypeColor: string;
  eventTypeLabelHe: string;
  status: WeeklyEventBar["status"];
  isCanceled?: boolean;
  isUpdated?: boolean;
  grades: string[];
}

interface MobileWeekDay {
  day: WeeklyModel["days"][number];
  events: MobileWeekEvent[];
}

export function GanttWeeklyMobileList({
  model,
  onDayClick,
  onEventClick,
}: {
  model: WeeklyModel;
  onDayClick?: (isoDate: string) => void;
  onEventClick: (eventId: string) => void;
}) {
  const t = useTranslations("gantt");
  const mobileDays = useMemo(() => buildMobileWeekDays(model), [model]);
  return (
    <section aria-label={t("mobileWeekList")} className="space-y-3 px-3 pb-3 md:hidden">
      {mobileDays.map(({ day, events }) => (
        <article
          key={day.dayIndex}
          data-date-status={day.dateStatus}
          style={day.closureColor ? { "--closure-color": day.closureColor } as React.CSSProperties : undefined}
          className="rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface)] p-3 shadow-sm"
        >
          <button
            type="button"
            onClick={() => onDayClick?.(isoDate(day.date))}
            disabled={!onDayClick}
            aria-label={t("mobileNewEventOnDate", { date: isoDate(day.date) })}
            className="flex w-full items-center justify-between gap-3 rounded-lg text-start disabled:pointer-events-none"
          >
            <span className="flex items-baseline gap-2">
              <span className="font-[var(--sg-font-display)] text-3xl font-bold text-[var(--sg-ink)]">
                {day.dayOfMonth}
              </span>
              <span className="font-[var(--sg-font-display)] text-base font-semibold text-[var(--sg-ink)]">
                {day.hebrewName}
              </span>
            </span>
            <span className="font-[var(--sg-font-mono)] text-[11px] tracking-wide text-[var(--sg-ink-mute)]">
              {day.monoName}
            </span>
          </button>
          <div className="mt-3 space-y-2">
            {events.length === 0 ? (
              <p className="rounded-lg bg-[var(--sg-surface-2)] px-3 py-2 text-sm text-[var(--sg-ink-mute)]">
                {t("mobileNoEvents")}
              </p>
            ) : (
              events.map((event) => (
                <MobileEventButton key={event.eventId} event={event} onSelect={onEventClick} />
              ))
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

function buildMobileWeekDays(model: WeeklyModel): MobileWeekDay[] {
  return model.days.map((day) => {
    const byEvent = new Map<string, MobileWeekEvent>();
    for (const row of model.rows) {
      for (const bar of row.bars) {
        if (day.dayIndex < bar.dayStart || day.dayIndex > bar.dayEnd) continue;
        const existing = byEvent.get(bar.eventId);
        if (existing) {
          existing.grades.push(row.hebrewLabel);
          continue;
        }
        byEvent.set(bar.eventId, {
          eventId: bar.eventId,
          title: bar.title,
          eventTypeKey: bar.eventTypeKey,
          eventTypeColor: bar.eventTypeColor,
          eventTypeLabelHe: bar.eventTypeLabelHe,
          status: bar.status,
          isCanceled: bar.isCanceled,
          isUpdated: bar.isUpdated,
          grades: [row.hebrewLabel],
        });
      }
    }
    return { day, events: Array.from(byEvent.values()) };
  });
}

function MobileEventButton({
  event,
  onSelect,
}: {
  event: MobileWeekEvent;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("gantt");
  const isCanceled = event.status === "canceled" || event.isCanceled;
  const isVacation = event.eventTypeKey === "vacation" || event.eventTypeKey === "bagrut";
  return (
    <button
      type="button"
      onClick={() => onSelect(event.eventId)}
      aria-label={event.title}
      className="flex w-full items-start gap-3 rounded-lg border border-[var(--sg-hairline-2)] bg-white p-3 text-start shadow-xs"
    >
      <span
        className="mt-1 size-8 shrink-0 rounded-full"
        style={{
          background: isVacation
            ? event.eventTypeColor
            : `color-mix(in oklch, ${event.eventTypeColor} 18%, white)`,
        }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block font-medium text-[var(--sg-ink)] ${isCanceled ? "line-through" : ""}`}
        >
          {event.title}
        </span>
        <span className="mt-1 block text-xs text-[var(--sg-ink-mute)]">
          {event.eventTypeLabelHe} · {t("gradesColumnLabel")} {event.grades.join(", ")}
        </span>
      </span>
      {(isCanceled || event.isUpdated) && (
        <span className="mt-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          {isCanceled ? "!" : "*"}
        </span>
      )}
    </button>
  );
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
