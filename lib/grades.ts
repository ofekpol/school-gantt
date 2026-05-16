export const HEBREW_GRADE_LABELS = {
  7: "ז",
  8: "ח",
  9: "ט",
  10: "י",
  11: "יא",
  12: "יב",
} as const;

export type IsraeliGrade = keyof typeof HEBREW_GRADE_LABELS;

export function formatGradeLabel(grade: number): string {
  return HEBREW_GRADE_LABELS[grade as IsraeliGrade] ?? String(grade);
}

export function formatGradeList(grades: number[]): string {
  return grades.map(formatGradeLabel).join(", ");
}
