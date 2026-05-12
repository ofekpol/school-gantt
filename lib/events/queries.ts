import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, withSchool } from "@/lib/db/client";
import {
  academicYears,
  editorScopes,
  eventGrades,
  events,
  schools,
} from "@/lib/db/schema";

/**
 * Returns the active academic year for the school, or null if none is configured.
 * Uses db directly for schools query — schools table has no RLS.
 */
export async function getActiveAcademicYear(schoolId: string) {
  const [school] = await db
    .select({ activeYearId: schools.activeAcademicYearId })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!school?.activeYearId) return null;
  const activeYearId = school.activeYearId;
  const [year] = await withSchool(schoolId, (tx) =>
    tx
      .select()
      .from(academicYears)
      .where(eq(academicYears.id, activeYearId))
      .limit(1),
  );
  return year ?? null;
}

/**
 * Returns grade numbers the editor is allowed to assign.
 * If the editor has zero grade-kind scopes (e.g. department editor),
 * returns all grades 7–12 per RESEARCH Open Question 4.
 */
export async function getEditorAllowedGrades(
  schoolId: string,
  staffUserId: string,
): Promise<number[]> {
  const rows = await withSchool(schoolId, (tx) =>
    tx
      .select({ scopeValue: editorScopes.scopeValue })
      .from(editorScopes)
      .where(
        and(
          eq(editorScopes.staffUserId, staffUserId),
          eq(editorScopes.scopeKind, "grade"),
        ),
      ),
  );
  if (rows.length === 0) return [7, 8, 9, 10, 11, 12];
  return rows.map((r) => Number(r.scopeValue));
}

export interface DashboardEvent {
  id: string;
  title: string | null;
  status: "draft" | "pending" | "approved" | "rejected";
  updatedAt: Date;
  startAt: Date | null;
  endAt: Date | null;
  eventTypeId: string;
}

/**
 * Returns the calling editor's non-deleted draft and pending events,
 * ordered most-recently-updated first (WIZARD-07).
 */
export async function getEditorDashboardEvents(
  schoolId: string,
  staffUserId: string,
): Promise<DashboardEvent[]> {
  return withSchool(schoolId, (tx) =>
    tx
      .select({
        id: events.id,
        title: events.title,
        status: events.status,
        updatedAt: events.updatedAt,
        startAt: events.startAt,
        endAt: events.endAt,
        eventTypeId: events.eventTypeId,
      })
      .from(events)
      .where(
        and(
          eq(events.createdBy, staffUserId),
          inArray(events.status, ["draft", "pending"]),
          isNull(events.deletedAt),
        ),
      )
      .orderBy(desc(events.updatedAt)),
  ) as Promise<DashboardEvent[]>;
}

export interface EventWithGrades {
  event: {
    id: string;
    title: string | null;
    description: string | null;
    location: string | null;
    startAt: Date | null;
    endAt: Date | null;
    allDay: boolean;
    status: "draft" | "pending" | "approved" | "rejected";
    version: number;
    eventTypeId: string;
    createdBy: string;
    updatedAt: Date;
  };
  grades: number[];
}

/**
 * Returns a single event with its grade list for an editor or admin.
 * Returns null when: not found, soft-deleted, cross-school (RLS), or
 * caller is not the owner and not admin.
 */
export async function getEventForEditor(
  schoolId: string,
  eventId: string,
  staffUserId: string,
  isAdmin: boolean,
): Promise<EventWithGrades | null> {
  const result = await withSchool(schoolId, async (tx) => {
    const [row] = await tx
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        location: events.location,
        startAt: events.startAt,
        endAt: events.endAt,
        allDay: events.allDay,
        status: events.status,
        version: events.version,
        eventTypeId: events.eventTypeId,
        createdBy: events.createdBy,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!row) return null;
    if (!isAdmin && row.createdBy !== staffUserId) return null;

    const gradeRows = await tx
      .select({ grade: eventGrades.grade })
      .from(eventGrades)
      .where(eq(eventGrades.eventId, eventId));

    return { event: row, grades: gradeRows.map((g) => g.grade) };
  });

  return result;
}
