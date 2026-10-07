import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCalendarModel, type CalendarInputEvent } from "@/lib/views/calendar";
import { buildCalendarRangeFromEvents } from "@/lib/views/date-range";

/**
 * Regression guard for the dashboard slow-load bug: building the calendar used to
 * format every event's dates once per (calendar day × event) — ~1.4M `Intl` calls
 * (~7 s) for 207 events over the 84-month display range. Asserting on call count
 * instead of wall-clock time keeps this deterministic on any machine.
 */
function schoolYearEvents(count: number): CalendarInputEvent[] {
  const typeKeys = ["holiday", "vacation", "exam", "trip", "general", "ceremony"];
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(Date.UTC(2026, 5, 2) + ((i * 37) % 385) * 86_400_000 + 8 * 3_600_000);
    const multiDay = i % 2 === 0;
    return {
      id: `event-${i}`,
      title: `Event ${i}`,
      startAt: start,
      endAt: new Date(start.getTime() + (multiDay ? 2 * 86_400_000 : 90 * 60_000)),
      allDay: multiDay,
      grades: [7 + (i % 6)],
      eventTypeKey: typeKeys[i % typeKeys.length],
      eventTypeLabelHe: "x",
      eventTypeColor: "#123456",
      eventTypeGlyph: "G",
    };
  });
}

describe("buildCalendarModel cost", () => {
  afterEach(() => vi.restoreAllMocks());

  it("formats each event's dates once, not once per calendar day", () => {
    const events = schoolYearEvents(207);
    const range = buildCalendarRangeFromEvents(events);
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts");

    const { months } = buildCalendarModel({ year: range, events });

    expect(months.length).toBeGreaterThan(80); // the full padded display range
    // ~2 per event + 2 per closure + 1 per cell is ≈ 4k; the old code made ≈ 1.4M.
    expect(spy.mock.calls.length).toBeLessThan(20_000);
  });
});
