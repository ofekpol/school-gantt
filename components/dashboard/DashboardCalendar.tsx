"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { GanttWeekly } from "@/components/Gantt/GanttWeekly";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import { NewEventDayDialog } from "./NewEventDayDialog";
import type { WeeklyModel } from "@/lib/views/gantt-weekly";
import type { CalendarMonth } from "@/lib/views/calendar";

interface SerializedEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  description: string | null;
  location: string | null;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  eventTypeGlyph: string;
  grades: number[];
}

interface Props {
  view: "weekly" | "monthly";
  weeklyModel?: WeeklyModel;
  months?: CalendarMonth[];
  events: SerializedEvent[];
  yearLabel: string;
  schoolName: string;
}

/**
 * Dashboard calendar wrapper — segmented toggle (weekly/monthly) + day-click
 * confirm dialog that routes to the event wizard with `?date=` pre-filled.
 * Toggle state is URL-driven via `?view=`.
 */
export function DashboardCalendar({
  view,
  weeklyModel,
  months,
  events,
  yearLabel,
  schoolName,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("dashboard");
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  function setView(next: "weekly" | "monthly") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-6 pt-4">
        <ToggleBtn active={view === "weekly"} onClick={() => setView("weekly")}>
          {t("viewWeekly")}
        </ToggleBtn>
        <ToggleBtn active={view === "monthly"} onClick={() => setView("monthly")}>
          {t("viewMonthly")}
        </ToggleBtn>
      </div>

      {view === "weekly" && weeklyModel && (
        <GanttWeekly
          model={weeklyModel}
          events={events}
          onDayClick={setPendingDate}
        />
      )}
      {view === "monthly" && months && (
        <YearCalendarGrid
          months={months}
          yearLabel={yearLabel}
          schoolName={schoolName}
          onDayClick={setPendingDate}
        />
      )}

      <NewEventDayDialog
        open={pendingDate !== null}
        dateIso={pendingDate}
        onClose={() => setPendingDate(null)}
      />
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}
