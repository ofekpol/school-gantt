import { describe, expect, it } from "vitest";
import { buildCalendarRangeFromEvents } from "@/lib/views/date-range";

describe("buildCalendarRangeFromEvents", () => {
  it("includes two prior calendar years plus the current two-year window", () => {
    const range = buildCalendarRangeFromEvents(
      [],
      new Date("2026-06-03T12:00:00.000Z"),
    );

    expect(range).toEqual({
      label: "2024-2027",
      startDate: "2024-01-01",
      endDate: "2027-12-31",
    });
  });

  it("includes two prior years for events in the second half of a school cycle", () => {
    const range = buildCalendarRangeFromEvents([
      {
        startAt: new Date("2027-02-15T08:00:00.000Z"),
        endAt: new Date("2027-02-15T09:00:00.000Z"),
      },
    ]);

    expect(range).toEqual({
      label: "2024-2027",
      startDate: "2024-01-01",
      endDate: "2027-12-31",
    });
  });

  it("expands beyond two years when events require a wider range", () => {
    const range = buildCalendarRangeFromEvents([
      {
        startAt: new Date("2026-09-01T08:00:00.000Z"),
        endAt: new Date("2028-01-10T09:00:00.000Z"),
      },
    ]);

    expect(range).toEqual({
      label: "2024-2028",
      startDate: "2024-01-01",
      endDate: "2028-12-31",
    });
  });
});
