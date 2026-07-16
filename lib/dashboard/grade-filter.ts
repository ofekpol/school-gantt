const VALID_GRADES = new Set([7, 8, 9, 10, 11, 12]);

export interface DashboardGradeSelection {
  selectedGrades: number[];
  dataGrades: number[];
}

export function getDashboardGradeSelection(
  allowedGrades: number[],
  rawGrades: string | string[] | undefined,
): DashboardGradeSelection {
  const allowed = normalizeAllowedGrades(allowedGrades);
  const requested = parseGradeParams(rawGrades);
  const selected = requested.filter((grade) => allowed.includes(grade));
  const selectedGrades = hasExplicitEmptySelection(rawGrades)
    ? []
    : selected.length > 0
      ? selected
      : allowed;

  return {
    selectedGrades,
    dataGrades: allowed,
  };
}

export function shouldShowDashboardGradeFilter(allowedGrades: number[]): boolean {
  return normalizeAllowedGrades(allowedGrades).length > 1;
}

function normalizeAllowedGrades(grades: number[]): number[] {
  const unique = grades.filter((grade) => VALID_GRADES.has(grade));
  return Array.from(new Set(unique)).sort((a, b) => a - b);
}

function parseGradeParams(rawGrades: string | string[] | undefined): number[] {
  const values = Array.isArray(rawGrades) ? rawGrades : rawGrades ? [rawGrades] : [];
  const parsed = values
    .flatMap((value) => value.split(","))
    .map((value) => Number(value))
    .filter((grade) => Number.isInteger(grade) && VALID_GRADES.has(grade));

  return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

function hasExplicitEmptySelection(rawGrades: string | string[] | undefined): boolean {
  const values = Array.isArray(rawGrades) ? rawGrades : rawGrades ? [rawGrades] : [];
  return values.includes("none");
}
