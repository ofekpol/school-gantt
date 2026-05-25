import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { getSchoolBySlug, type PublicSchoolRecord } from "@/lib/db/schools";
import { getActiveAcademicYear, listEventTypes } from "@/lib/events/queries";
import { getAgendaForSchool, getAgendaSignatureForSchool } from "@/lib/views/agenda";
import { toPublicEventPayload, type PublicViewerEvent } from "@/lib/views/public-viewer";

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
  year: PublicViewerYear | null;
  eventTypes: PublicViewerEventType[];
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

  const [year, eventTypes] = await Promise.all([
    getActiveAcademicYear(school.id),
    listEventTypes(school.id),
  ]);
  const events = year
    ? await getAgendaForSchool(school.id, {
        yearBounds: { startDate: year.startDate, endDate: year.endDate },
      })
    : [];
  const eventSignature = year
    ? await getAgendaSignatureForSchool(school.id, {
        yearBounds: { startDate: year.startDate, endDate: year.endDate },
      })
    : "no-active-year";

  return {
    school,
    year: year
      ? { label: year.label, startDate: year.startDate, endDate: year.endDate }
      : null,
    eventTypes,
    events: events.map(toPublicEventPayload),
    eventSignature,
  };
}

export async function loadPublicViewerEvents(slug: string): Promise<PublicViewerEvent[] | null> {
  const data = await loadPublicViewerData(slug);
  return data ? data.events : null;
}

export async function loadPublicViewerEventSignature(slug: string): Promise<string | null> {
  const school = await getSchoolBySlug(slug);
  if (!school) return null;

  const year = await getActiveAcademicYear(school.id);
  if (!year) return "no-active-year";

  return getAgendaSignatureForSchool(school.id, {
    yearBounds: { startDate: year.startDate, endDate: year.endDate },
  });
}
