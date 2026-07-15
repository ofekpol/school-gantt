import { describe, expect, it } from "vitest";
import { buildEventTimeRange } from "@/lib/events/date-range";

describe("buildEventTimeRange", () => {
  it("creates an inclusive all-day range", () => {
    expect(
      buildEventTimeRange({
        startDate: "2026-07-14",
        endDate: "2026-07-16",
        allDay: true,
        startTime: "08:00",
        endTime: "09:00",
      }),
    ).toEqual({
      startAt: "2026-07-14T00:00:00+02:00",
      endAt: "2026-07-16T23:59:59+02:00",
    });
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      buildEventTimeRange({
        startDate: "2026-07-16",
        endDate: "2026-07-14",
        allDay: true,
        startTime: "08:00",
        endTime: "09:00",
      }),
    ).toThrow(RangeError);
  });

  it("keeps a timed event on its selected date", () => {
    expect(
      buildEventTimeRange({
        startDate: "2026-07-14",
        allDay: false,
        startTime: "08:00",
        endTime: "09:00",
      }),
    ).toEqual({
      startAt: "2026-07-14T08:00:00+02:00",
      endAt: "2026-07-14T09:00:00+02:00",
    });
  });
});
