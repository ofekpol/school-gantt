import { describe, it, expect } from "vitest";
import {
  buildGanttModel,
  type GanttInputEvent,
} from "@/lib/views/gantt";

const YEAR = {
  startDate: "2026-09-01",
  endDate: "2027-07-31",
};

const TYPE = {
  key: "trip",
  labelHe: "טיול",
  colorHex: "#ff0000",
  glyph: "T",
};

describe("buildGanttModel: positions events by date offset within the year", () => {
  it("event on the first day starts at 0% and width matches duration", () => {
    const evt: GanttInputEvent = {
      id: "e1",
      title: "first day",
      startAt: new Date("2026-09-01T08:00:00+03:00"),
      endAt: new Date("2026-09-01T16:00:00+03:00"),
      allDay: false,
      description: null,
      location: null,
      grades: [10],
      eventTypeKey: TYPE.key,
      eventTypeLabelHe: TYPE.labelHe,
      eventTypeColor: TYPE.colorHex,
      eventTypeGlyph: TYPE.glyph,
    };
    const model = buildGanttModel({ year: YEAR, grades: [7, 8, 9, 10, 11, 12], events: [evt] });
    expect(model.bars).toHaveLength(1);
    const bar = model.bars[0];
    // Year starts 2026-09-01 UTC; event starts 2026-09-01T05:00 UTC, so left
    // is a fraction of the first day. Allow up to half a percent.
    expect(bar.leftPct).toBeCloseTo(0, 0);
    // Min bar width is 1 day worth of the year; year is 334 days so ~0.3%.
    expect(bar.widthPct).toBeGreaterThan(0);
    expect(bar.widthPct).toBeLessThan(1);
    expect(bar.rowStart).toBe(3); // grade 10 is index 3 (7→0,8→1,9→2,10→3)
    expect(bar.rowSpan).toBe(1);
  });

  it("event in the middle of the year has left ~50%", () => {
    const evt: GanttInputEvent = {
      id: "e-mid",
      title: "mid",
      startAt: new Date("2027-02-15T08:00:00+03:00"),
      endAt: new Date("2027-02-15T16:00:00+03:00"),
      allDay: true,
      description: null,
      location: null,
      grades: [10],
      eventTypeKey: TYPE.key,
      eventTypeLabelHe: TYPE.labelHe,
      eventTypeColor: TYPE.colorHex,
      eventTypeGlyph: TYPE.glyph,
    };
    const model = buildGanttModel({ year: YEAR, grades: [7, 8, 9, 10, 11, 12], events: [evt] });
    expect(model.bars[0].leftPct).toBeGreaterThan(40);
    expect(model.bars[0].leftPct).toBeLessThan(60);
  });

  it("multi-grade event spans contiguous rows for adjacent grades", () => {
    const evt: GanttInputEvent = {
      id: "multi",
      title: "multi 9-11",
      startAt: new Date("2026-10-01T08:00:00+03:00"),
      endAt: new Date("2026-10-01T16:00:00+03:00"),
      allDay: false,
      description: null,
      location: null,
      grades: [9, 10, 11],
      eventTypeKey: TYPE.key,
      eventTypeLabelHe: TYPE.labelHe,
      eventTypeColor: TYPE.colorHex,
      eventTypeGlyph: TYPE.glyph,
    };
    const model = buildGanttModel({ year: YEAR, grades: [7, 8, 9, 10, 11, 12], events: [evt] });
    expect(model.bars).toHaveLength(1);
    expect(model.bars[0].rowStart).toBe(2);
    expect(model.bars[0].rowSpan).toBe(3);
  });

  it("multi-grade event with non-contiguous grades emits one bar per contiguous run", () => {
    const evt: GanttInputEvent = {
      id: "split",
      title: "9 and 11",
      startAt: new Date("2026-10-01T08:00:00+03:00"),
      endAt: new Date("2026-10-01T16:00:00+03:00"),
      allDay: false,
      description: null,
      location: null,
      grades: [9, 11],
      eventTypeKey: TYPE.key,
      eventTypeLabelHe: TYPE.labelHe,
      eventTypeColor: TYPE.colorHex,
      eventTypeGlyph: TYPE.glyph,
    };
    const model = buildGanttModel({ year: YEAR, grades: [7, 8, 9, 10, 11, 12], events: [evt] });
    expect(model.bars).toHaveLength(2);
    const sorted = model.bars.slice().sort((a, b) => a.rowStart - b.rowStart);
    expect(sorted[0].rowStart).toBe(2);
    expect(sorted[0].rowSpan).toBe(1);
    expect(sorted[1].rowStart).toBe(4);
    expect(sorted[1].rowSpan).toBe(1);
  });

  it("clamps event extending past the year end", () => {
    const evt: GanttInputEvent = {
      id: "overflow",
      title: "past end",
      startAt: new Date("2027-07-30T08:00:00+03:00"),
      endAt: new Date("2027-08-15T16:00:00+03:00"),
      allDay: false,
      description: null,
      location: null,
      grades: [10],
      eventTypeKey: TYPE.key,
      eventTypeLabelHe: TYPE.labelHe,
      eventTypeColor: TYPE.colorHex,
      eventTypeGlyph: TYPE.glyph,
    };
    const model = buildGanttModel({ year: YEAR, grades: [7, 8, 9, 10, 11, 12], events: [evt] });
    expect(model.bars).toHaveLength(1);
    expect(model.bars[0].leftPct + model.bars[0].widthPct).toBeCloseTo(100, 0);
  });

  it("skips events fully outside the display range", () => {
    const evt: GanttInputEvent = {
      id: "outside",
      title: "summer break",
      startAt: new Date("2027-08-01T08:00:00+03:00"),
      endAt: new Date("2027-08-15T16:00:00+03:00"),
      allDay: false,
      description: null,
      location: null,
      grades: [10],
      eventTypeKey: TYPE.key,
      eventTypeLabelHe: TYPE.labelHe,
      eventTypeColor: TYPE.colorHex,
      eventTypeGlyph: TYPE.glyph,
    };
    const model = buildGanttModel({ year: YEAR, grades: [7, 8, 9, 10, 11, 12], events: [evt] });
    expect(model.bars).toHaveLength(0);
  });

  it("includes a months axis with 11 month markers Sept..Jul", () => {
    const model = buildGanttModel({ year: YEAR, grades: [7, 8, 9, 10, 11, 12], events: [] });
    expect(model.months).toHaveLength(11);
    expect(model.months[0].monthIndex).toBe(9); // September
    expect(model.months[10].monthIndex).toBe(7); // July
  });

  it("assigns different lanes to overlapping events in the same grade", () => {
    const model = buildGanttModel({
      year: YEAR,
      grades: [7, 8, 9, 10, 11, 12],
      events: [
        eventForGrade("a", 10, "2026-10-01T08:00:00+03:00", "2026-10-03T16:00:00+03:00"),
        eventForGrade("b", 10, "2026-10-02T08:00:00+03:00", "2026-10-04T16:00:00+03:00"),
        eventForGrade("c", 10, "2026-10-05T08:00:00+03:00", "2026-10-06T16:00:00+03:00"),
      ],
    });

    const lanes = new Map(model.bars.map((bar) => [bar.id, bar.lane]));

    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("b")).toBe(1);
    expect(lanes.get("c")).toBe(0);
    expect(model.bars.every((bar) => bar.laneCount === 2)).toBe(true);
  });
});

function eventForGrade(
  id: string,
  grade: number,
  startAt: string,
  endAt: string,
): GanttInputEvent {
  return {
    id,
    title: id,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    allDay: false,
    description: null,
    location: null,
    grades: [grade],
    eventTypeKey: TYPE.key,
    eventTypeLabelHe: TYPE.labelHe,
    eventTypeColor: TYPE.colorHex,
    eventTypeGlyph: TYPE.glyph,
  };
}
