"use client";

import { useTranslations } from "next-intl";
import { formatGradeLabel } from "@/lib/grades";
import { gradeTextColor, type GradeColorMap } from "@/lib/grade-colors";

interface Props {
  grades: number[];
  selected: number[];
  gradeColors: GradeColorMap;
  onChange: (next: number[]) => void;
}

/**
 * Multi-select grade focus. Clicking a grade toggles it; there is no
 * "select all" — an empty selection already means every grade is shown.
 * Each button carries its grade color so users learn the color mapping.
 */
export function GradeSelector({ grades, selected, gradeColors, onChange }: Props) {
  const t = useTranslations("dashboard");

  function toggle(grade: number) {
    const next = selected.includes(grade)
      ? selected.filter((item) => item !== grade)
      : [...selected, grade].sort((a, b) => a - b);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
      <span className="text-sm font-medium text-neutral-600">{t("gradeFilterLabel")}</span>
      <div className="flex gap-1.5 overflow-x-auto overflow-y-hidden">
        {grades.map((grade) => {
          const active = selected.includes(grade);
          const color = gradeColors[grade];
          return (
            <button
              key={grade}
              type="button"
              onClick={() => toggle(grade)}
              aria-pressed={active}
              aria-label={t("gradeFilterOption", { grade: formatGradeLabel(grade) })}
              className="inline-flex h-9 min-w-11 items-center justify-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold transition-colors"
              style={
                active
                  ? { backgroundColor: color, borderColor: color, color: gradeTextColor(color) }
                  : { backgroundColor: "#ffffff", borderColor: "#E2DFD7", color: "#1d1d1b" }
              }
            >
              {!active && (
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              {formatGradeLabel(grade)}
            </button>
          );
        })}
      </div>
      {selected.length === 0 ? (
        <span className="text-sm text-neutral-500">{t("gradeSelectionHint")}</span>
      ) : (
        <button
          type="button"
          onClick={() => onChange([])}
          className="h-9 px-2 text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
        >
          {t("clearGradeSelection")}
        </button>
      )}
    </div>
  );
}
