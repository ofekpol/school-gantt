import type { AgendaItem } from "@/lib/views/agenda-model";
import type { ZoomLevel } from "@/lib/views/gantt";

export type PublicViewerView = "gantt" | "calendar" | "agenda";

export interface PublicViewerEvent extends Omit<AgendaItem, "startAt" | "endAt"> {
  startAt: string;
  endAt: string;
  eventTypeId: string;
}

export interface PublicViewerParams {
  grades: number[];
  types: string[];
  q: string;
  zoom: ZoomLevel;
  week: string | null;
}

export function parsePublicViewerParams(params: URLSearchParams): PublicViewerParams {
  const zoom = parseZoomParam(params.get("zoom"));
  return {
    grades: parseGradeValues(params.getAll("grades")),
    types: parseTextValues(params.getAll("types")),
    q: (params.get("q") ?? "").trim(),
    zoom,
    week: parseWeek(params.get("week")),
  };
}

export function serializePublicViewerParams(params: PublicViewerParams): string {
  const query = new URLSearchParams();
  for (const grade of sortNumbers(params.grades)) query.append("grades", String(grade));
  for (const type of sortStrings(params.types)) query.append("types", type);
  const q = params.q.trim();
  if (q) query.set("q", q);
  if (params.zoom !== "year") query.set("zoom", params.zoom);
  if (params.week && params.zoom === "week") query.set("week", params.week);
  return query.toString();
}

export function filterPublicEvents(
  events: PublicViewerEvent[],
  params: PublicViewerParams,
): PublicViewerEvent[] {
  const gradeSet = new Set(params.grades);
  const typeSet = new Set(params.types);
  const q = params.q.trim().toLocaleLowerCase("he-IL");

  return events.filter((event) => {
    if (gradeSet.size > 0 && !event.grades.some((grade) => gradeSet.has(grade))) return false;
    if (typeSet.size > 0 && !typeSet.has(event.eventTypeKey)) return false;
    if (q && !event.title.toLocaleLowerCase("he-IL").includes(q)) return false;
    return true;
  });
}

export function hydratePublicEvents(events: PublicViewerEvent[]): AgendaItem[] {
  return events.map((event) => ({
    ...event,
    startAt: new Date(event.startAt),
    endAt: new Date(event.endAt),
  }));
}

export function toPublicEventPayload(
  event: Omit<AgendaItem, "startAt" | "endAt"> & { startAt: Date | string; endAt: Date | string },
): PublicViewerEvent {
  return {
    ...event,
    eventTypeId: event.eventTypeId ?? "",
    startAt: toIso(event.startAt),
    endAt: toIso(event.endAt),
    grades: sortNumbers(event.grades),
    status: event.status ?? "approved",
    isCanceled: event.isCanceled === true,
    isUpdated: event.isUpdated === true,
  };
}

function parseZoomParam(raw: string | null): ZoomLevel {
  if (raw === "week" || raw === "month" || raw === "term") return raw;
  return "year";
}

function parseWeek(raw: string | null): string | null {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function parseGradeValues(values: string[]): number[] {
  return sortNumbers(
    values
      .flatMap((value) => value.split(","))
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 7 && value <= 12),
  );
}

function parseTextValues(values: string[]): string[] {
  return sortStrings(values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean));
}

function sortNumbers(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function sortStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
