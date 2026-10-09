import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { getSchoolBySlug, type PublicSchoolRecord } from "@/lib/db/schools";
import { getGradeColors } from "@/lib/db/grade-colors";
import type { GradeColorMap } from "@/lib/grade-colors";
import { listEventTypes } from "@/lib/events/queries";
import { getAgendaForSchool, getAgendaSignatureForSchool } from "@/lib/views/agenda";
import { toPublicEventPayload, type PublicViewerEvent } from "@/lib/views/public-viewer";
import { buildCalendarRangeFromEvents } from "@/lib/views/date-range";

export interface PublicViewerEventType {
  id: string;
  key: string;
  labelHe: string;
  labelEn: string;
  colorHex: string;
  glyph: string;
  sortOrder: number;
}

export interface PublicViewerYear {
  label: string;
  startDate: string;
  endDate: string;
}

export interface PublicViewerData {
  school: PublicSchoolRecord;
  year: PublicViewerYear;
  eventTypes: PublicViewerEventType[];
  gradeColors: GradeColorMap;
  events: PublicViewerEvent[];
  eventSignature: string;
}

export function getPublicViewerCacheTag(slug: string): string {
  return `public-viewer:${slug}`;
}

export function invalidatePublicViewerCache(slug: string | null | undefined): void {
  if (!slug) return;
  revalidateTag(getPublicViewerCacheTag(slug));
}

export async function loadPublicViewerData(slug: string): Promise<PublicViewerData | null> {
  return unstable_cache(
    () => loadPublicViewerDataUncached(slug),
    ["public-viewer-data", slug],
    { revalidate: 5, tags: [getPublicViewerCacheTag(slug)] },
  )();
}

async function loadPublicViewerDataUncached(slug: string): Promise<PublicViewerData | null> {
  const school = await getSchoolBySlug(slug);
  if (!school) return null;

  const [eventTypes, gradeColors, events, eventSignature] = await Promise.all([
    listEventTypes(school.id),
    getGradeColors(school.id),
    getAgendaForSchool(school.id, {}),
    getAgendaSignatureForSchool(school.id, {}),
  ]);
  const year = buildCalendarRangeFromEvents(events);

  return {
    school,
    year,
    eventTypes,
    gradeColors,
    events: events.map(toPublicEventPayload),
    eventSignature,
  };
}

export async function loadPublicViewerEvents(slug: string): Promise<PublicViewerEvent[] | null> {
  return unstable_cache(
    () => loadPublicViewerEventsUncached(slug),
    ["public-viewer-events", slug],
    { revalidate: 5, tags: [getPublicViewerCacheTag(slug)] },
  )();
}

async function loadPublicViewerEventsUncached(slug: string): Promise<PublicViewerEvent[] | null> {
  const school = await getSchoolBySlug(slug);
  if (!school) return null;

  const events = await getAgendaForSchool(school.id, {});
  return events.map(toPublicEventPayload);
}

export async function loadPublicViewerEventSignature(slug: string): Promise<string | null> {
  const school = await getSchoolBySlug(slug);
  if (!school) return null;

  return getAgendaSignatureForSchool(school.id, {});
}
