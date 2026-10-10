import { describe, expect, it } from "vitest";
import { serializeCalendar } from "@/lib/ical/serializer";
import { eventJerusalemDateRange } from "@/lib/views/date-status";

/**
 * Real production rows after migration 0013 (verified on the test DB):
 * [allDay, startAt (UTC), endAt (UTC), wall clock the editor typed, typed end].
 */
const ROWS: [boolean, string, string, string, string][] = [
  [true, "2026-09-11T21:00:00Z", "2026-09-12T20:59:59Z", "2026-09-12 00:00", "2026-09-12 23:59"],
  [false, "2026-09-15T06:00:00Z", "2026-09-15T09:00:00Z", "2026-09-15 09:00", "2026-09-15 12:00"],
  [false, "2026-10-25T07:00:00Z", "2026-10-25T09:00:00Z", "2026-10-25 09:00", "2026-10-25 11:00"],
  [true, "2026-10-26T22:00:00Z", "2026-10-27T21:59:59Z", "2026-10-27 00:00", "2026-10-27 23:59"],
  [true, "2026-10-27T22:00:00Z", "2026-10-30T21:59:59Z", "2026-10-28 00:00", "2026-10-30 23:59"],
  [true, "2026-11-29T22:00:00Z", "2026-12-06T21:59:59Z", "2026-11-30 00:00", "2026-12-06 23:59"],
  [false, "2027-03-16T06:00:00Z", "2027-03-16T10:00:00Z", "2027-03-16 08:00", "2027-03-16 12:00"],
  [true, "2027-04-05T21:00:00Z", "2027-04-06T20:59:59Z", "2027-04-06 00:00", "2027-04-06 23:59"],
  [false, "2027-05-03T07:00:00Z", "2027-05-03T10:13:00Z", "2027-05-03 10:00", "2027-05-03 13:13"],
  [false, "2027-06-21T05:00:00Z", "2027-06-21T06:00:00Z", "2027-06-21 08:00", "2027-06-21 09:00"],
];

const wallClock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

describe("migrated production rows", () => {
  it.each(ROWS)("allDay=%s %s displays as typed", (allDay, start, end, typedStart, typedEnd) => {
    const startAt = new Date(start);
    const endAt = new Date(end);
    expect(wallClock.format(startAt)).toBe(typedStart);
    expect(wallClock.format(endAt)).toBe(typedEnd);

    // Calendar/Gantt day span is exactly the typed days.
    expect(eventJerusalemDateRange({ startAt, endAt })).toEqual({
      startDate: typedStart.slice(0, 10),
      endDate: typedEnd.slice(0, 10),
    });

    if (allDay) {
      const body = serializeCalendar({
        schoolName: "s",
        schoolSlug: "s",
        events: [{ id: "x", title: "t", description: null, location: null, startAt, endAt, allDay, eventTypeLabelHe: "t", updatedAt: startAt }],
      });
      const dayAfterEnd = new Date(`${typedEnd.slice(0, 10)}T12:00:00Z`);
      dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
      expect(body).toContain(`DTSTART;VALUE=DATE:${typedStart.slice(0, 10).replace(/-/g, "")}`);
      expect(body).toContain(`DTEND;VALUE=DATE:${dayAfterEnd.toISOString().slice(0, 10).replace(/-/g, "")}`);
    }
  });
});
