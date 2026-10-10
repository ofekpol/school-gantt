"use client";

import { useTranslations } from "next-intl";
import { formatGradeLabel } from "@/lib/grades";
import {
  DIMMED_EVENT_COLORS,
  SCHOOL_GRADES,
  WHOLE_SCHOOL_COLOR,
  type GradeColorMap,
} from "@/lib/grade-colors";

interface Props {
  gradeColors: GradeColorMap;
  /** Show the "outside selection" swatch (only meaningful with a grade focus). */
  showDimmed?: boolean;
}

/** Key for the grade-colored month grid: one swatch per grade plus the special cases. */
export function GradeColorLegend({ gradeColors, showDimmed = false }: Props) {
  const t = useTranslations("calendar");
  return (
    <ul
      aria-label={t("legendTitle")}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-4 text-[13px] text-neutral-700 print:px-0"
    >
      {SCHOOL_GRADES.map((grade) => (
        <LegendItem key={grade} label={t("legendGrade", { grade: formatGradeLabel(grade) })}>
          <Swatch background={gradeColors[grade]} />
        </LegendItem>
      ))}
      <LegendItem label={t("legendMulti")}>
        <span className="inline-flex h-3 w-6 items-center justify-center gap-px rounded-sm border border-[#CFCBC1] bg-white">
          <Dot color={gradeColors[SCHOOL_GRADES[0]]} />
          <Dot color={gradeColors[SCHOOL_GRADES[1]]} />
        </span>
      </LegendItem>
      <LegendItem label={t("legendWholeSchool")}>
        <Swatch background={WHOLE_SCHOOL_COLOR} />
      </LegendItem>
      {showDimmed && (
        <LegendItem label={t("legendDimmed")}>
          <Swatch background={DIMMED_EVENT_COLORS.fill} />
        </LegendItem>
      )}
    </ul>
  );
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {children}
      <span>{label}</span>
    </li>
  );
}

function Swatch({ background }: { background: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-6 rounded-sm border border-black/15"
      style={{ background }}
    />
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: color }} />;
}
