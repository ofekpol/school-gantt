import type { CSSProperties } from "react";
import {
  DIMMED_EVENT_COLORS,
  eventColorScheme,
  gradeTagLabel,
  isEventInGradeSelection,
  type GradeColorMap,
} from "@/lib/grade-colors";

const CANCELED_STYLE: CSSProperties = {
  backgroundColor: "#fee2e2",
  color: "#991b1b",
  textDecoration: "line-through",
};

export interface CalendarEventVisual {
  style: CSSProperties;
  /** Grade dot colors (multi-grade events only). */
  dots: string[];
  /** False when the event is outside the current grade selection. */
  highlighted: boolean;
  /** Grade label shown on the chip ("ז", "ז–ח", whole-school label). */
  tag: string;
}

/**
 * Resolves how one calendar chip/segment is painted. Color comes from a single
 * source (grade); canceled events keep their strikethrough + label treatment.
 */
export function calendarEventVisual(
  item: { grades: number[]; isCanceled?: boolean },
  gradeColors: GradeColorMap,
  selectedGrades: readonly number[],
  wholeSchoolLabel: string,
): CalendarEventVisual {
  const highlighted = isEventInGradeSelection(item.grades, selectedGrades);
  const tag = gradeTagLabel(item.grades, wholeSchoolLabel);
  if (item.isCanceled) return { style: CANCELED_STYLE, dots: [], highlighted, tag };
  if (!highlighted) {
    return {
      style: { backgroundColor: DIMMED_EVENT_COLORS.fill, color: DIMMED_EVENT_COLORS.text },
      dots: [],
      highlighted,
      tag,
    };
  }
  const scheme = eventColorScheme(item.grades, gradeColors);
  return {
    style: {
      backgroundColor: scheme.fill,
      color: scheme.text,
      ...(scheme.kind === "multi" ? { borderColor: "#CFCBC1" } : {}),
    },
    dots: scheme.dots,
    highlighted,
    tag,
  };
}

interface BodyProps {
  tag: string;
  glyph: string;
  title: string;
  dots: string[];
  badge: string | null;
}

/** Inner content shared by single-day chips and multi-day segments. */
export function CalendarEventBody({ tag, glyph, title, dots, badge }: BodyProps) {
  return (
    <>
      {dots.length > 0 && (
        <span aria-hidden="true" className="flex shrink-0 items-center gap-px">
          {dots.map((color, index) => (
            <span
              key={`${color}-${index}`}
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
      )}
      <span aria-hidden="true" className="shrink-0 font-bold">{tag}</span>
      <span aria-hidden="true" className="event-chip-glyph hidden opacity-70 sm:inline">
        {glyph}
      </span>
      <span className="truncate">{title}</span>
      {badge && (
        <span className="shrink-0 rounded-full bg-white/70 px-1 text-[8px] font-bold">
          {badge}
        </span>
      )}
    </>
  );
}
