import { buildEventTimeRange, type EventTimeRange } from "@/lib/events/date-range";
import type { EventQuickPublishInput } from "@/lib/validations/events";
import { DATE_CODES, INFORMATIONAL_CODES, type AdderWarning, type CandidateEvent } from "./types";
import { hasValidTimes } from "./fields";

/** Client-safe rules for whether a reviewed candidate can be published. */

function timesOk(c: CandidateEvent): boolean {
  return hasValidTimes(c.allDay, c.startTime, c.endTime, c.endDate !== null && c.endDate !== c.startDate);
}

/** The candidate's instant range, or null while date/times are incomplete. */
export function candidateTimeRange(c: CandidateEvent): EventTimeRange | null {
  if (!c.startDate || !timesOk(c)) return null;
  return buildEventTimeRange({
    startDate: c.startDate,
    endDate: c.endDate ?? undefined,
    allDay: c.allDay === true,
    startTime: c.startTime ?? "00:00",
    endTime: c.endTime ?? "23:59",
  });
}

export function isCandidateComplete(c: CandidateEvent, allowedGrades: number[]): boolean {
  return (
    c.title.trim().length > 0 &&
    c.eventTypeId !== null &&
    c.grades.some((g) => allowedGrades.includes(g)) &&
    candidateTimeRange(c) !== null
  );
}

/** Body for POST /api/v1/events/publish. Out-of-scope grades are dropped. */
export function toPublishPayload(c: CandidateEvent, allowedGrades: number[]): EventQuickPublishInput {
  const range = candidateTimeRange(c);
  if (!range || !isCandidateComplete(c, allowedGrades) || !c.eventTypeId) {
    throw new Error("incomplete_candidate");
  }
  return {
    title: c.title.trim(),
    startAt: range.startAt,
    endAt: range.endAt,
    allDay: c.allDay === true,
    eventTypeId: c.eventTypeId,
    grades: c.grades.filter((g) => allowedGrades.includes(g)),
    ...(c.location.trim() ? { location: c.location.trim() } : {}),
    ...(c.description.trim() ? { description: c.description.trim() } : {}),
  };
}

/**
 * Warnings that apply to the candidate as it is now — field warnings are
 * recomputed after the user's edits; calendar warnings are carried over.
 */
export function currentWarnings(c: CandidateEvent, allowedGrades: number[]): AdderWarning[] {
  const out: AdderWarning[] = [];
  if (!c.title.trim()) out.push({ code: "missing_title" });
  if (!c.startDate) {
    out.push(c.warnings.find((w) => DATE_CODES.has(w.code)) ?? { code: "missing_date" });
  }
  if (!timesOk(c)) out.push({ code: "missing_time" });
  if (c.grades.length === 0) out.push({ code: "missing_grades" });
  const outOfScope = c.grades.filter((g) => !allowedGrades.includes(g));
  if (outOfScope.length > 0) out.push({ code: "grade_out_of_scope", grades: outOfScope });
  if (!c.eventTypeId) out.push({ code: "uncertain_type" });
  return [...out, ...c.warnings.filter((w) => INFORMATIONAL_CODES.has(w.code))];
}
