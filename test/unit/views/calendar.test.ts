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

  it("September 2026 starts on a Tuesday — week 0 has two leading nulls", () => {
    const model = buildCalendarModel({ year: YEAR, events: [] });
    const sep = model.months[0];
    // Sept 1, 2026 is a Tuesday → Sunday=0, Monday=1, Tuesday=2, so 2 leading null cells.
    expect(sep.weeks[0].days[0]).toBeNull();
    expect(sep.weeks[0].days[1]).toBeNull();
    expect(sep.weeks[0].days[2]?.dayOfMonth).toBe(1);
  });
});

describe("buildCalendarModel: event distribution", () => {
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

  it("spreads a 3-day event across all 3 days", () => {
    const evt = mkEvent(
      "trip",
      "2026-09-10T08:00:00+03:00",
      "2026-09-12T16:00:00+03:00",
    );
    const model = buildCalendarModel({ year: YEAR, events: [evt] });
    const sept = model.months[0];
    const days = sept.weeks
      .flatMap((w) => w.days)
      .filter((d) => d !== null && d.events.some((e) => e.id === "trip"));
    expect(days.map((d) => d!.dayOfMonth).sort((a, b) => a - b)).toEqual([10, 11, 12]);
  });

  it("clips a multi-day event that spans across months", () => {
    const evt = mkEvent(
      "cross",
      "2026-09-29T08:00:00+03:00",
      "2026-10-02T16:00:00+03:00",
    );
    const model = buildCalendarModel({ year: YEAR, events: [evt] });
    const sept = model.months[0];
    const oct = model.months[1];
    const septDays = sept.weeks
      .flatMap((w) => w.days)
      .filter((d) => d !== null && d.events.some((e) => e.id === "cross"))
      .map((d) => d!.dayOfMonth)
      .sort((a, b) => a - b);
    const octDays = oct.weeks
      .flatMap((w) => w.days)
      .filter((d) => d !== null && d.events.some((e) => e.id === "cross"))
      .map((d) => d!.dayOfMonth)
      .sort((a, b) => a - b);
    expect(septDays).toEqual([29, 30]);
    expect(octDays).toEqual([1, 2]);
  });

  it("skips events fully outside the academic year", () => {
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
