import { readableTextColor } from "@/lib/colors";
import { formatGradeLabel } from "@/lib/grades";

/**
 * Grade color system for calendar views.
 *
 * Events are colored by ONE source at a time. Today that source is the grade;
 * a future "color by event type" mode adds a branch in `eventColorScheme`
 * (returning no grade dots) without touching callers. An event never carries
 * two color sources: the
 * grade label (text) and event-type glyph always stay, so swapping the fill
 * never loses information.
 */

export const SCHOOL_GRADES = [7, 8, 9, 10, 11, 12] as const;

/** Color-blind-safe defaults (Okabe–Ito derived). No reds: red means "canceled". */
export const DEFAULT_GRADE_COLORS: Readonly<Record<number, string>> = {
  7: "#0F6FB0",
  8: "#E69F00",
  9: "#00805F",
  10: "#CC79A7",
  11: "#6B4C9A",
  12: "#56B4E9",
};

/** Curated palette admins pick from. Free-form hex is intentionally not allowed. */
export const GRADE_COLOR_OPTIONS = [
  "#0F6FB0",
  "#E69F00",
  "#00805F",
  "#CC79A7",
  "#6B4C9A",
  "#56B4E9",
  "#7A7A2E",
  "#3D7D8F",
  "#8C6D46",
  "#9DB83A",
] as const;

export type GradeColorOption = (typeof GRADE_COLOR_OPTIONS)[number];

/** Fill for events that include every grade in the school. */
export const WHOLE_SCHOOL_COLOR = "#2F343B";

/** Fill/text for events outside the selected grades (monthly view). */
export const DIMMED_EVENT_COLORS = { fill: "#EFEDE7", text: "#8A8984" } as const;

export type GradeColorMap = Record<number, string>;

export type EventColorKind = "single" | "multi" | "school";

export interface EventColorScheme {
  kind: EventColorKind;
  fill: string;
  text: string;
  /** Grade colors to render as dots — only for multi-grade events in grade mode. */
  dots: string[];
}

/** Merges stored overrides on top of the defaults so every school grade has a color. */
export function resolveGradeColors(
  overrides: ReadonlyArray<{ grade: number; colorHex: string }>,
): GradeColorMap {
  const map: GradeColorMap = { ...DEFAULT_GRADE_COLORS };
  for (const row of overrides) {
    if (row.grade in map) map[row.grade] = row.colorHex;
  }
  return map;
}

export function isWholeSchoolEvent(grades: readonly number[]): boolean {
  return grades.length === 0 || SCHOOL_GRADES.every((grade) => grades.includes(grade));
}

export function gradeTextColor(colorHex: string): string {
  return readableTextColor(colorHex);
}

export function eventColorScheme(
  grades: readonly number[],
  gradeColors: GradeColorMap,
): EventColorScheme {
  if (isWholeSchoolEvent(grades)) {
    return { kind: "school", fill: WHOLE_SCHOOL_COLOR, text: "#ffffff", dots: [] };
  }
  if (grades.length === 1) {
    const fill = gradeColors[grades[0]] ?? WHOLE_SCHOOL_COLOR;
    return { kind: "single", fill, text: gradeTextColor(fill), dots: [] };
  }
  const sorted = [...grades].sort((a, b) => a - b);
  return {
    kind: "multi",
    fill: "#ffffff",
    text: "#1d1d1b",
    dots: sorted.map((grade) => gradeColors[grade] ?? WHOLE_SCHOOL_COLOR),
  };
}

/**
 * True when the event should render in full color for the current grade
 * selection. An empty selection means "no lens" — everything is highlighted.
 * Whole-school events always stay highlighted.
 */
export function isEventInGradeSelection(
  grades: readonly number[],
  selectedGrades: readonly number[],
): boolean {
  if (selectedGrades.length === 0 || isWholeSchoolEvent(grades)) return true;
  return grades.some((grade) => selectedGrades.includes(grade));
}

/** Stable-sorts events in the grade selection first, so dimmed ones overflow last. */
export function sortBySelection<T extends { grades: readonly number[] }>(
  events: readonly T[],
  selectedGrades: readonly number[],
): T[] {
  if (selectedGrades.length === 0) return [...events];
  const rank = (event: T) => (isEventInGradeSelection(event.grades, selectedGrades) ? 0 : 1);
  return [...events].sort((a, b) => rank(a) - rank(b));
}

/**
 * Short grade tag shown on every chip so the grade is readable without the
 * legend: "ז", "ז–ח" (consecutive), "ז, ט" (gaps), or the whole-school label.
 */
export function gradeTagLabel(grades: readonly number[], wholeSchoolLabel: string): string {
  if (isWholeSchoolEvent(grades)) return wholeSchoolLabel;
  const sorted = [...grades].sort((a, b) => a - b);
  const consecutive = sorted.every((grade, index) => index === 0 || grade === sorted[index - 1] + 1);
  if (sorted.length > 1 && consecutive) {
    return `${formatGradeLabel(sorted[0])}–${formatGradeLabel(sorted[sorted.length - 1])}`;
  }
  return sorted.map(formatGradeLabel).join(", ");
}
