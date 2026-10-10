"use client";

import { memo } from "react";
import { LoadingPanel } from "@/components/LoadingPanel";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import { GradeColorLegend } from "@/components/GradeColorLegend";
import { DEFAULT_GRADE_COLORS } from "@/lib/grade-colors";
import type { buildCalendarModel } from "@/lib/views/calendar";
import type { PublicViewerYear } from "@/lib/views/public-viewer-data";
import type { GradeColorMap } from "@/lib/grade-colors";

interface Props {
  months: ReturnType<typeof buildCalendarModel>["months"];
  year: PublicViewerYear;
  schoolName: string;
  gradeColors?: GradeColorMap;
  onMonthChange: (month: { year: number; monthIndex: number }) => void;
}

export const PublicCalendarView = memo(function PublicCalendarView({
  months,
  year,
  schoolName,
  gradeColors,
  onMonthChange,
}: Props) {
  if (months.length === 0) return <LoadingPanel compact />;

  return (
    <>
      <YearCalendarGrid
        months={months}
        yearLabel={year.label}
        schoolName={schoolName}
        gradeColors={gradeColors}
        onMonthChange={onMonthChange}
      />
      <GradeColorLegend gradeColors={gradeColors ?? DEFAULT_GRADE_COLORS} />
    </>
  );
});
