import { describe, expect, it } from "vitest";
import {
  filterPublicEvents,
  parsePublicViewerParams,
  serializePublicViewerParams,
  shouldRefreshPublicEvents,
  toPublicEventPayload,
  type PublicViewerEvent,
} from "@/lib/views/public-viewer";
import { groupByWeek } from "@/lib/views/agenda-model";

const baseEvent: PublicViewerEvent = {
  id: "event-1",
  title: "מסע שכבה",
  startAt: "2026-09-15T06:00:00.000Z",
  endAt: "2026-09-15T09:00:00.000Z",
  allDay: false,
  description: null,
  location: null,
  eventTypeId: "type-1",
  eventTypeKey: "trip",
  eventTypeLabelHe: "טיול",
  eventTypeColor: "#0ea5e9",
  eventTypeGlyph: "compass",
  grades: [9, 10],
  status: "approved",
  isCanceled: false,
  isUpdated: false,
};

describe("public viewer URL params", () => {
  it("parses repeated and comma-separated filters into stable values", () => {
    const params = parsePublicViewerParams(
      new URLSearchParams("grades=10,9&grades=bad&types=trip&types=exam&q=%20hello%20&zoom=month&week=2026-09-13"),
    );

    expect(params).toEqual({
      grades: [9, 10],
      types: ["exam", "trip"],
      q: "hello",
      zoom: "month",
      week: "2026-09-13",
    });
  });

  it("serializes canonical shareable query strings", () => {
    const query = serializePublicViewerParams({
      grades: [10, 9],
      types: ["trip", "exam"],
      q: " hello ",
      zoom: "year",
      week: "2026-09-13",
    });

    expect(query).toBe("grades=9&grades=10&types=exam&types=trip&q=hello");
  });
});

describe("public viewer event filtering", () => {
  it("filters by selected grades, event types, and case-insensitive title search", () => {
    const events = [
      baseEvent,
      { ...baseEvent, id: "event-2", title: "בגרות מתמטיקה", eventTypeKey: "exam", grades: [11] },
      { ...baseEvent, id: "event-3", title: "טיול יא", grades: [11] },
    ];

    const filtered = filterPublicEvents(events, {
      grades: [10, 11],
      types: ["trip"],
      q: "טיול",
      zoom: "year",
      week: null,
    });

    expect(filtered.map((event) => event.id)).toEqual(["event-3"]);
  });
});

describe("public viewer event refresh decisions", () => {
  it("fetches full events only when the lightweight signature changes", () => {
    expect(shouldRefreshPublicEvents("2:4:now", "2:4:now")).toBe(false);
    expect(shouldRefreshPublicEvents("2:4:now", "3:5:later")).toBe(true);
  });
});

describe("public viewer payload mapping", () => {
  it("serializes Date-backed agenda items once at the boundary", () => {
    const payload = toPublicEventPayload({
      ...baseEvent,
      startAt: new Date("2026-09-15T06:00:00.000Z"),
      endAt: new Date("2026-09-15T09:00:00.000Z"),
    });

    expect(payload.startAt).toBe("2026-09-15T06:00:00.000Z");
    expect(payload.endAt).toBe("2026-09-15T09:00:00.000Z");
    expect(payload.grades).toEqual([9, 10]);
  });
});

describe("agenda grouping", () => {
  it("groups public events by Sunday-start Jerusalem weeks without server-only imports", () => {
    const weeks = groupByWeek([
      { ...baseEvent, startAt: new Date("2026-09-15T06:00:00.000Z"), endAt: new Date("2026-09-15T09:00:00.000Z") },
      { ...baseEvent, id: "event-2", startAt: new Date("2026-09-21T06:00:00.000Z"), endAt: new Date("2026-09-21T09:00:00.000Z") },
    ]);

    expect(weeks.map((week) => week.weekStart)).toEqual(["2026-09-13", "2026-09-20"]);
  });
});
