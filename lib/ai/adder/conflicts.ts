import "server-only";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventGrades, events } from "@/lib/db/schema";
import { jerusalemDateString } from "@/lib/datetime";
import { candidateTimeRange } from "./complete";
import type { AdderWarning, CandidateEvent } from "./types";

interface ExistingEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  grades: number[];
}

interface Window {
  clientId: string;
  title: string;
  date: string;
  start: Date;
  end: Date;
  grades: number[];
}

/** Title identity for duplicate detection: trimmed, case-folded, single spaces. */
function titleKey(title: string): string {
  return title.trim().toLocaleLowerCase("he").replace(/\s+/g, " ");
}

function toWindows(candidates: CandidateEvent[]): Window[] {
  return candidates.flatMap((c) => {
    const range = candidateTimeRange(c);
    if (!range || !c.startDate) return [];
    const start = new Date(range.startAt);
    const end = new Date(range.endAt);
    return [{ clientId: c.clientId, title: c.title, date: c.startDate, start, end, grades: c.grades }];
  });
}

async function loadExisting(schoolId: string, from: Date, to: Date): Promise<ExistingEvent[]> {
  return withSchool(schoolId, async (tx) => {
    const rows = await tx
      .select({ id: events.id, title: events.title, startAt: events.startAt, endAt: events.endAt })
      .from(events)
      .where(
        and(
          eq(events.schoolId, schoolId),
          eq(events.status, "approved"),
          isNull(events.deletedAt),
          lte(events.startAt, to),
          gte(events.endAt, from),
        ),
      );
    if (rows.length === 0) return [];
    const gradeRows = await tx
      .select({ eventId: eventGrades.eventId, grade: eventGrades.grade })
      .from(eventGrades)
      .where(inArray(eventGrades.eventId, rows.map((r) => r.id)));
    return rows.map((r) => ({
      ...r,
      grades: gradeRows.filter((g) => g.eventId === r.id).map((g) => g.grade).sort((a, b) => a - b),
    }));
  });
}

function warningsFor(w: Window, existing: ExistingEvent[]): AdderWarning[] {
  const out: AdderWarning[] = [];
  for (const e of existing) {
    if (titleKey(e.title) === titleKey(w.title) && jerusalemDateString(e.startAt) === w.date) {
      out.push({ code: "duplicate", eventId: e.id, title: e.title, date: w.date });
      continue;
    }
    const intersects = w.start < e.endAt && w.end > e.startAt;
    if (intersects && e.grades.some((g) => w.grades.includes(g))) {
      out.push({
        code: "overlap",
        eventId: e.id,
        title: e.title,
        grades: e.grades,
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
      });
    }
  }
  return out;
}

/**
 * Duplicate and overlap warnings per candidate (keyed by clientId), against
 * the school's approved, non-deleted events. Incomplete candidates are skipped.
 */
export async function findConflicts(
  schoolId: string,
  candidates: CandidateEvent[],
): Promise<Map<string, AdderWarning[]>> {
  const result = new Map<string, AdderWarning[]>();
  const windows = toWindows(candidates);
  if (windows.length === 0) return result;
  // Widen by a day so same-date duplicates at other times are found too.
  const day = 24 * 60 * 60 * 1000;
  const from = new Date(Math.min(...windows.map((w) => w.start.getTime())) - day);
  const to = new Date(Math.max(...windows.map((w) => w.end.getTime())) + day);
  const existing = await loadExisting(schoolId, from, to);
  for (const w of windows) {
    const warnings = warningsFor(w, existing);
    if (warnings.length > 0) result.set(w.clientId, warnings);
  }
  return result;
}
