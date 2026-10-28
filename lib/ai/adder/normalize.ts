import type { AdderWarning, CandidateEvent, ExtractedEvent } from "./types";
import {
  ALL_GRADES,
  cleanGrades,
  hasValidTimes,
  isPlausibleDayMonth,
  normalizeTime,
  toIsoDate,
} from "./fields";

export interface NormalizeContext {
  eventTypes: { id: string; key: string }[];
  /** Event types the user may use; null = all (admin). */
  allowedTypeIds: Set<string> | null;
  allowedGrades: number[];
  /** "YYYY-MM-DD", Asia/Jerusalem. */
  today: string;
}

/** Caps on model-written text so the adder can't be used to return long free text. */
const MAX_TITLE = 120;
const MAX_LOCATION = 255;
const MAX_DESCRIPTION = 500;

const cap = (value: string | null, max: number) => (value ?? "").trim().slice(0, max);

interface DateResult {
  startDate: string | null;
  endDate: string | null;
  dateHint: { day: number; month: number } | null;
  warning: AdderWarning | null;
}

/**
 * Resolves the start/end dates from the parts the model copied out of the text.
 * A range borrows a missing start month/year from its end ("12-14/11/26") and
 * vice versa — that is what the text says, not a guess. A missing year stays
 * missing.
 */
function resolveDates(ex: ExtractedEvent): DateResult {
  const hasEnd = ex.endDay !== null;
  const month = ex.startMonth ?? (hasEnd ? ex.endMonth : null);
  const year = ex.startYear ?? (hasEnd ? ex.endYear : null);
  const none = { startDate: null, endDate: null, dateHint: null };
  if (ex.startDay === null || month === null) return { ...none, warning: { code: "missing_date" } };
  if (year === null) {
    if (!isPlausibleDayMonth(ex.startDay, month)) return { ...none, warning: { code: "invalid_date" } };
    return { ...none, dateHint: { day: ex.startDay, month }, warning: { code: "missing_year" } };
  }
  const startDate = toIsoDate(ex.startDay, month, year);
  if (!startDate) return { ...none, warning: { code: "invalid_date" } };
  if (!hasEnd || ex.endDay === null) return { startDate, endDate: null, dateHint: null, warning: null };
  const endDate = toIsoDate(ex.endDay, ex.endMonth ?? month, ex.endYear ?? year);
  if (!endDate || endDate < startDate) return { ...none, warning: { code: "invalid_date" } };
  return { startDate, endDate: endDate === startDate ? null : endDate, dateHint: null, warning: null };
}

function resolveTypeId(ex: ExtractedEvent, ctx: NormalizeContext): string | null {
  if (!ex.typeConfident || !ex.eventTypeKey) return null;
  const type = ctx.eventTypes.find((t) => t.key === ex.eventTypeKey);
  if (!type) return null;
  if (ctx.allowedTypeIds && !ctx.allowedTypeIds.has(type.id)) return null;
  return type.id;
}

/** Turns one extracted event into a reviewable candidate. Pure. */
export function normalizeExtracted(
  ex: ExtractedEvent,
  ctx: NormalizeContext,
  clientId: string,
): CandidateEvent {
  const title = cap(ex.title, MAX_TITLE);
  const dates = resolveDates(ex);
  const allDay = ex.allDay;
  const startTime = allDay === true ? null : normalizeTime(ex.startTime);
  const endTime = allDay === true ? null : normalizeTime(ex.endTime);
  const grades = ex.allGrades ? [...ALL_GRADES] : cleanGrades(ex.grades);
  const outOfScope = grades.filter((g) => !ctx.allowedGrades.includes(g));
  const eventTypeId = resolveTypeId(ex, ctx);

  const warnings: AdderWarning[] = [];
  if (!title) warnings.push({ code: "missing_title" });
  if (dates.warning) warnings.push(dates.warning);
  if (!hasValidTimes(allDay, startTime, endTime, dates.endDate !== null)) {
    warnings.push({ code: "missing_time" });
  }
  if (grades.length === 0) warnings.push({ code: "missing_grades" });
  if (outOfScope.length > 0) warnings.push({ code: "grade_out_of_scope", grades: outOfScope });
  if (!eventTypeId) warnings.push({ code: "uncertain_type" });
  if (ex.recurring) warnings.push({ code: "recurring" });

  return {
    clientId,
    title,
    startDate: dates.startDate,
    endDate: dates.endDate,
    dateHint: dates.dateHint,
    startTime,
    endTime,
    allDay,
    grades,
    eventTypeId,
    location: cap(ex.location, MAX_LOCATION),
    description: cap(ex.description, MAX_DESCRIPTION),
    warnings,
  };
}
