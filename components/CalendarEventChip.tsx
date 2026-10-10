import type { CSSProperties } from "react";
import { formatGradeLabel } from "@/lib/grades";
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

const MUTED_TAB: CSSProperties = { background: "#D9D6CE", color: "#6B6A65" };

export interface GradeTab {
  label: string;
  style: CSSProperties;
}

export interface CalendarEventVisual {
  style: CSSProperties;
  /** Grade tabs at the start of the chip: dark grade tone on the pastel fill. */
  tabs: GradeTab[];
  /** False when the event is outside the current grade selection. */
  highlighted: boolean;
  /** Plain-text grade label ("ז", "ז–ח", whole-school label) for titles/a11y. */
  tag: string;
}

/**
 * Resolves how one calendar chip/segment is painted (design "M1-B"): a pastel
 * chip in the grade color with a dark grade tab; multi-grade events are white
 * with one tab per grade; whole-school events use the neutral school swatch.
 */
export function calendarEventVisual(
  item: { grades: number[]; isCanceled?: boolean },
  gradeColors: GradeColorMap,
  selectedGrades: readonly number[],
  wholeSchoolLabel: string,
): CalendarEventVisual {
  const highlighted = isEventInGradeSelection(item.grades, selectedGrades);
  const tag = gradeTagLabel(item.grades, wholeSchoolLabel);
  const scheme = eventColorScheme(item.grades, gradeColors);
  const labels =
    scheme.kind === "school"
      ? [wholeSchoolLabel]
      : [...item.grades].sort((a, b) => a - b).map(formatGradeLabel);
  const muted = item.isCanceled === true || !highlighted;
  const tabs = labels.map((label, index) => ({
    label,
    style: muted
      ? MUTED_TAB
      : { background: scheme.swatches[index].ink, color: scheme.swatches[index].fill },
  }));
  if (item.isCanceled) return { style: CANCELED_STYLE, tabs, highlighted, tag };
  if (!highlighted) {
    return {
      style: { backgroundColor: DIMMED_EVENT_COLORS.fill, color: DIMMED_EVENT_COLORS.text },
      tabs,
      highlighted,
      tag,
    };
  }
  return {
    style: {
      backgroundColor: scheme.fill,
      color: scheme.text,
      ...(scheme.kind === "multi" ? { borderColor: "#E0DDD5" } : {}),
    },
    tabs,
    highlighted,
    tag,
  };
}

interface BodyProps {
  tabs: GradeTab[];
  title: string;
  badge: string | null;
}

/** Inner content shared by single-day chips and multi-day segments. */
export function CalendarEventBody({ tabs, title, badge }: BodyProps) {
  return (
    <>
      <span aria-hidden="true" className="inline-flex shrink-0 gap-0.5">
        {tabs.map((tab, index) => (
          <span
            key={`${tab.label}-${index}`}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] px-1 text-[10px] font-bold"
            style={tab.style}
          >
            {tab.label}
          </span>
        ))}
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
