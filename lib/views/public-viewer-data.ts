import "server-only";
import { getSchoolBySlug, type PublicSchoolRecord } from "@/lib/db/schools";
import { getActiveAcademicYear, listEventTypes } from "@/lib/events/queries";
import { getAgendaForSchool } from "@/lib/views/agenda";
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
}

export async function loadPublicViewerData(slug: string): Promise<PublicViewerData | null> {
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

  return {
    school,
    year: year
      ? { label: year.label, startDate: year.startDate, endDate: year.endDate }
      : null,
    eventTypes,
    events: events.map(toPublicEventPayload),
  };
}

export async function loadPublicViewerEvents(slug: string): Promise<PublicViewerEvent[] | null> {
  const data = await loadPublicViewerData(slug);
  return data ? data.events : null;
}
