import { describe, expect, it } from "vitest";
import { getCalendarDateStatus } from "@/lib/views/date-status";

function event(
  eventTypeKey: string,
  startAt: string,
  endAt: string,
  isCanceled = false,
) {
  return {
    eventTypeKey,
    eventTypeColor: "#64748b",
    startAt: new Date(`${startAt}T00:00:00Z`),
    endAt: new Date(`${endAt}T00:00:00Z`),
    isCanceled,
  };
}

describe("getCalendarDateStatus", () => {
  it("marks Friday and Saturday as faint weekends", () => {
    expect(getCalendarDateStatus(new Date("2026-09-04T12:00:00Z"), [])).toBe("weekend");
    expect(getCalendarDateStatus(new Date("2026-09-05T12:00:00Z"), [])).toBe("weekend");
  });

  it("gives an approved holiday precedence over vacation and weekend", () => {
    const events = [
      event("holiday", "2026-09-04", "2026-09-06"),
      event("vacation", "2026-09-04", "2026-09-06"),
    ];
    expect(getCalendarDateStatus(new Date("2026-09-04T12:00:00Z"), events)).toBe("holiday");
  });

  it("marks custom holiday and vacation event types as closures", () => {
    expect(
      getCalendarDateStatus(
        new Date("2026-09-06T12:00:00Z"),
        [event("bridge-vacation", "2026-09-06", "2026-09-07")],
      ),
    ).toBe("vacation");
    expect(
      getCalendarDateStatus(
        new Date("2026-09-07T12:00:00Z"),
        [event("national_holiday", "2026-09-07", "2026-09-08")],
      ),
    ).toBe("holiday");
  });

  it("ignores cancelled closure events", () => {
    expect(
      getCalendarDateStatus(
        new Date("2026-09-06T12:00:00Z"),
        [event("holiday", "2026-09-06", "2026-09-07", true)],
      ),
    ).toBe("normal");
  });
});
