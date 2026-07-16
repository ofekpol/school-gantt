import { describe, it, expect } from "vitest";
import {
  buildCalendarModel,
  type CalendarInputEvent,
} from "@/lib/views/calendar";

const YEAR = { startDate: "2026-09-01", endDate: "2027-07-31" };

const TYPE = {
  key: "trip",
  labelHe: "טיול",
  colorHex: "#ff0000",
  glyph: "T",
};

function mkEvent(
  id: string,
  startIso: string,
  endIso: string,
  grades = [10],
): CalendarInputEvent {
  return {
    id,
    title: id,
    startAt: new Date(startIso),
    endAt: new Date(endIso),
    allDay: false,
    grades,
    eventTypeKey: TYPE.key,
    eventTypeLabelHe: TYPE.labelHe,
    eventTypeColor: TYPE.colorHex,
    eventTypeGlyph: TYPE.glyph,
  };
}

describe("buildCalendarModel: month sequence and grid shape", () => {
  it("emits 11 months from Sept 2026 through Jul 2027", () => {
    const model = buildCalendarModel({ year: YEAR, events: [] });
    expect(model.months).toHaveLength(11);
    expect(model.months[0].year).toBe(2026);
    expect(model.months[0].monthIndex).toBe(9);
    expect(model.months[10].year).toBe(2027);
    expect(model.months[10].monthIndex).toBe(7);
  });

  it("each month has 6 weeks of 7 cells (Sunday-start)", () => {
    const model = buildCalendarModel({ year: YEAR, events: [] });
    for (const m of model.months) {
      expect(m.weeks.length).toBeGreaterThanOrEqual(4);
      expect(m.weeks.length).toBeLessThanOrEqual(6);
      for (const w of m.weeks) {
        expect(w.days).toHaveLength(7);
      }
    }
  });

  it("fills September's leading cells with dimmed August dates", () => {
    const model = buildCalendarModel({ year: YEAR, events: [] });
    const sep = model.months[0];
    // Sept 1, 2026 is a Tuesday, so Sunday and Monday show Aug 30–31.
    expect(sep.weeks[0].days[0]).toMatchObject({
      date: "2026-08-30",
      dayOfMonth: 30,
      inMonth: false,
    });
    expect(sep.weeks[0].days[1]).toMatchObject({
      date: "2026-08-31",
      dayOfMonth: 31,
      inMonth: false,
    });
    expect(sep.weeks[0].days[2]).toMatchObject({
      date: "2026-09-01",
      dayOfMonth: 1,
      inMonth: true,
    });
  });
});

describe("buildCalendarModel: event distribution", () => {
  it("marks a holiday date with its event type color", () => {
    const holiday = {
      ...mkEvent("holiday", "2026-09-15T00:00:00Z", "2026-09-16T00:00:00Z"),
      eventTypeKey: "holiday",
      eventTypeColor: "#64748b",
    };
    const day = buildCalendarModel({ year: YEAR, events: [holiday] }).months[0].weeks
      .flatMap((week) => week.days)
      .find((item) => item?.date === "2026-09-15");

    expect(day).toMatchObject({ dateStatus: "holiday", closureColor: "#64748b" });
  });

  it("places a single-day event on its day", () => {
    const evt = mkEvent(
      "single",
      "2026-09-15T08:00:00+03:00",
      "2026-09-15T16:00:00+03:00",
    );
    const model = buildCalendarModel({ year: YEAR, events: [evt] });
    const sept = model.months[0];
    const day15 = sept.weeks
      .flatMap((w) => w.days)
      .find((d) => d?.dayOfMonth === 15);
    expect(day15?.events.map((e) => e.id)).toEqual(["single"]);
  });

  it("shows events on visible dates from the preceding month", () => {
    const evt = mkEvent(
      "previous-month",
      "2026-08-31T08:00:00+03:00",
      "2026-08-31T16:00:00+03:00",
    );
    const september = buildCalendarModel({ year: YEAR, events: [evt] }).months[0];
    const day = september.weeks
      .flatMap((week) => week.days)
      .find((item) => item?.date === "2026-08-31");

    expect(day).toMatchObject({ inMonth: false });
    expect(day?.events.map((chip) => chip.id)).toEqual(["previous-month"]);
  });

  it("projects a 3-day event as one connected weekly segment", () => {
    const evt = mkEvent(
      "trip",
      "2026-09-10T08:00:00+03:00",
      "2026-09-12T16:00:00+03:00",
    );
    const model = buildCalendarModel({ year: YEAR, events: [evt] });
    const week = model.months[0].weeks[1];

    expect(weekSegments(week)).toMatchObject([
      {
        eventId: "trip",
        startColumn: 4,
        endColumn: 6,
        lane: 0,
        continuesBefore: false,
        continuesAfter: false,
      },
    ]);
    expect(week.days.flatMap((day) => day?.events ?? [])).not.toContainEqual(
      expect.objectContaining({ eventId: "trip" }),
    );
  });

  it("splits a range at calendar-week boundaries with continuation edges", () => {
    const evt = mkEvent(
      "cross-week",
      "2026-09-12T08:00:00+03:00",
      "2026-09-15T16:00:00+03:00",
    );
    const weeks = buildCalendarModel({ year: YEAR, events: [evt] }).months[0].weeks;

    expect(weekSegments(weeks[1])).toMatchObject([
      { eventId: "cross-week", startColumn: 6, endColumn: 6, continuesAfter: true },
    ]);
    expect(weekSegments(weeks[2])).toMatchObject([
      { eventId: "cross-week", startColumn: 0, endColumn: 2, continuesBefore: true },
    ]);
  });

  it("assigns overlapping connected ranges to separate lanes", () => {
    const first = mkEvent("first", "2026-09-09T08:00:00+03:00", "2026-09-11T16:00:00+03:00");
    const second = mkEvent("second", "2026-09-10T08:00:00+03:00", "2026-09-12T16:00:00+03:00");
    const week = buildCalendarModel({ year: YEAR, events: [first, second] }).months[0].weeks[1];

    expect(weekSegments(week)).toMatchObject([
      { eventId: "first", lane: 0 },
      { eventId: "second", lane: 1 },
    ]);
    expect((week as { laneCount?: number }).laneCount).toBe(2);
  });

  it("projects a cross-month event in the adjacent-month week grid", () => {
    const evt = mkEvent(
      "cross",
      "2026-09-29T08:00:00+03:00",
      "2026-10-02T16:00:00+03:00",
    );
    const model = buildCalendarModel({ year: YEAR, events: [evt] });
    const sept = model.months[0];
    const oct = model.months[1];
    const septSegment = sept.weeks.flatMap((week) => weekSegments(week) as unknown[])
      .find((segment) => (segment as { eventId?: string }).eventId === "cross");
    const octSegment = oct.weeks.flatMap((week) => weekSegments(week) as unknown[])
      .find((segment) => (segment as { eventId?: string }).eventId === "cross");

    expect(septSegment).toMatchObject({ startColumn: 2, endColumn: 5 });
    expect(octSegment).toMatchObject({ startColumn: 2, endColumn: 5 });
  });

  it("skips events fully outside the display range", () => {
    const evt = mkEvent(
      "summer",
      "2027-08-01T08:00:00+03:00",
      "2027-08-15T16:00:00+03:00",
    );
    const model = buildCalendarModel({ year: YEAR, events: [evt] });
    const total = model.months
      .flatMap((m) => m.weeks)
      .flatMap((w) => w.days)
      .filter((d) => d?.events.some((e) => e.id === "summer")).length;
    expect(total).toBe(0);
  });
});

function weekSegments(week: unknown): unknown {
  return (week as { segments?: unknown }).segments;
}
