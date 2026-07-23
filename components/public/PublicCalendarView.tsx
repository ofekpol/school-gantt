"use client";

import { memo } from "react";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import type { buildCalendarModel } from "@/lib/views/calendar";
import type { PublicViewerYear } from "@/lib/views/public-viewer-data";

interface Props {
  months: ReturnType<typeof buildCalendarModel>["months"];
  year: PublicViewerYear;
  schoolName: string;
  onMonthChange: (month: { year: number; monthIndex: number }) => void;
}

export const PublicCalendarView = memo(function PublicCalendarView({
  months,
  year,
  schoolName,
  onMonthChange,
}: Props) {
  return (
    <YearCalendarGrid
      months={months}
      yearLabel={year.label}
      schoolName={schoolName}
      onMonthChange={onMonthChange}
    />
  );
});
