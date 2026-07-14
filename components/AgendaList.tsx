"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AgendaItem } from "@/lib/views/agenda-model";
import { formatGradeList } from "@/lib/grades";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar-url";
import { findCurrentAgendaWeekStart } from "@/lib/views/current-period";
import { getCalendarDateStatusDetail } from "@/lib/views/date-status";

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
  mode?: "week" | "month";
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
 * Period-grouped vertical agenda — public mobile view. Tap a row to expand its
 * description/location. 44 px tap targets per WCAG + Lighthouse mobile a11y.
 */
export function AgendaList({ weeks, emptyLabel, mode = "week" }: Props) {
  const t = useTranslations("agenda");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const periods = useMemo(
    () => (mode === "month" ? groupWeeksByMonth(weeks) : weeks.map(weekToPeriod)),
    [mode, weeks],
  );
  const [selectedIndex, setSelectedIndex] = useState(() => initialPeriodIndex(periods, mode));

  useEffect(() => {
    setSelectedIndex(initialPeriodIndex(periods, mode));
  }, [mode, periods]);

  if (periods.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-neutral-500">{emptyLabel}</p>
    );
  }

  const period = periods[selectedIndex];

  return (
    <div className="px-4 pt-4">
      <section key={period.key} aria-labelledby={`agenda-period-${period.key}`}>
        <header className="mb-3 flex items-center justify-center gap-2">
          <PeriodButton
            label={t(mode === "month" ? "previousMonth" : "previousWeek")}
            disabled={selectedIndex === 0}
            onClick={() => setSelectedIndex((index) => Math.max(index - 1, 0))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </PeriodButton>
          <h2
            id={`agenda-period-${period.key}`}
            className="min-w-36 text-center text-sm font-semibold text-neutral-500"
          >
            {period.label}
          </h2>
          <PeriodButton
            label={t(mode === "month" ? "nextMonth" : "nextWeek")}
            disabled={selectedIndex === periods.length - 1}
            onClick={() => setSelectedIndex((index) => Math.min(index + 1, periods.length - 1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </PeriodButton>
        </header>
        <ul className="space-y-2">
          {period.items.map((item) => (
            <AgendaRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function AgendaRow({
  item,
  expanded,
  onToggle,
}: {
  item: SerializedAgendaItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("agenda");
  const tExport = useTranslations("export");
  const startDate = new Date(item.startAt);
  const endDate = new Date(item.endAt);
  const status = getCalendarDateStatusDetail(startDate, [
    {
      startAt: startDate,
      endAt: endDate,
      eventTypeKey: item.eventTypeKey,
      eventTypeColor: item.eventTypeColor,
      isCanceled: item.isCanceled,
      status: item.status,
    },
  ]);

  return (
    <li
      data-date-status={status.status}
      style={status.closureColor ? { "--closure-color": status.closureColor } as React.CSSProperties : undefined}
      className="rounded-lg"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`event-detail-${item.id}`}
        className="flex min-h-[44px] w-full items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-start hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span
          aria-hidden="true"
          className="mt-1 inline-flex size-3 shrink-0 items-center justify-center rounded-full border border-neutral-300"
          style={{ backgroundColor: item.eventTypeColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`truncate text-sm font-medium ${item.isCanceled ? "text-red-800 line-through" : ""}`}>
              {item.title}
            </p>
            {(item.isCanceled || item.isUpdated) && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                item.isCanceled ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
              }`}>
                {item.isCanceled ? t("canceled") : t("updated")}
              </span>
            )}
          </div>
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
              <span aria-hidden="true" className="text-xs">
                {item.eventTypeGlyph}
              </span>
              {item.eventTypeLabelHe}
            </span>
            {item.grades.length > 0 && (
              <span className="ms-2">
                · {formatGradeList(item.grades)}
              </span>
            )}
          </p>
        </div>
      </button>
      {expanded && (
        <div
          id={`event-detail-${item.id}`}
          className="mt-1 space-y-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-700"
        >
          {item.location && (
            <p>
              <span className="font-medium">{t("location")}:</span>{" "}
              {item.location}
            </p>
          )}
          {item.description && (
            <p className="whitespace-pre-wrap">{item.description}</p>
          )}
          {!item.location && !item.description && (
            <p className="text-neutral-400">{t("noDetails")}</p>
          )}
          <a
            href={buildGoogleCalendarUrl({
              title: item.title,
              start: startDate,
              end: endDate,
              description: item.description ?? undefined,
              location: item.location ?? undefined,
              allDay: item.allDay,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            {tExport("addToGoogle")}
          </a>
        </div>
      )}
    </li>
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
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

interface AgendaPeriod {
  key: string;
  label: string;
  items: SerializedAgendaItem[];
}

function weekToPeriod(week: SerializedAgendaWeek): AgendaPeriod {
  return {
    key: week.weekStart,
    label: [
      weekHeaderFmt.format(new Date(`${week.weekStart}T00:00:00+03:00`)),
      weekHeaderFmt.format(new Date(addDays(week.weekStart, 6) + "T00:00:00+03:00")),
    ].join(" – "),
    items: week.items,
  };
}

function groupWeeksByMonth(weeks: SerializedAgendaWeek[]): AgendaPeriod[] {
  const byMonth = new Map<string, SerializedAgendaItem[]>();
  for (const week of weeks) {
    for (const item of week.items) {
      const key = monthKey(new Date(item.startAt));
      byMonth.set(key, [...(byMonth.get(key) ?? []), item]);
    }
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      label: monthLabel(key),
      items: items.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      ),
    }));
}

function initialPeriodIndex(periods: AgendaPeriod[], mode: "week" | "month"): number {
  if (periods.length === 0) return 0;
  if (mode === "week") {
    const currentWeekStart = findCurrentAgendaWeekStart(
      periods.map((period) => ({ weekStart: period.key })),
    );
    const index = periods.findIndex((period) => period.key === currentWeekStart);
    return index >= 0 ? index : 0;
  }

  const todayMonth = monthKey(new Date());
  const current = periods.findIndex((period) => period.key === todayMonth);
  if (current >= 0) return current;
  const next = periods.findIndex((period) => period.key > todayMonth);
  return next >= 0 ? next : periods.length - 1;
}

function monthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
