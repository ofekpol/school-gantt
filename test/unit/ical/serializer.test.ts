import { describe, it, expect } from "vitest";
import { serializeCalendar, type ICalEvent } from "@/lib/ical/serializer";

function evt(overrides: Partial<ICalEvent> = {}): ICalEvent {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Trip",
    description: "Bus departs at 08:00",
    location: "Tiberias",
    startAt: new Date("2026-10-15T08:00:00.000Z"),
    endAt: new Date("2026-10-15T16:00:00.000Z"),
    eventTypeLabelHe: "טיול",
    allDay: false,
    updatedAt: new Date("2026-09-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("serializeCalendar", () => {
  it("wraps VEVENTs in a VCALENDAR with VERSION 2.0 and PRODID", () => {
    const out = serializeCalendar({
      schoolName: "Test School",
      schoolSlug: "test",
      events: [evt()],
    });
    expect(out).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(out).toMatch(/VERSION:2\.0\r\n/);
    expect(out).toMatch(/PRODID:/);
    expect(out).toMatch(/END:VCALENDAR\r\n$/);
  });

  it("uses CRLF line endings everywhere", () => {
    const out = serializeCalendar({
      schoolName: "S",
      schoolSlug: "s",
      events: [evt()],
    });
    // Every newline must be preceded by a carriage return.
    const lines = out.split("\n");
    for (const line of lines.slice(0, -1)) {
      expect(line.endsWith("\r")).toBe(true);
    }
  });

  it("emits SUMMARY, DTSTART, DTEND, LOCATION, DESCRIPTION, CATEGORIES per PRD §6.4", () => {
    const out = serializeCalendar({
      schoolName: "S",
      schoolSlug: "s",
      events: [evt()],
    });
    expect(out).toMatch(/SUMMARY:Trip\r\n/);
    expect(out).toMatch(/DTSTART:20261015T080000Z\r\n/);
    expect(out).toMatch(/DTEND:20261015T160000Z\r\n/);
    expect(out).toMatch(/LOCATION:Tiberias\r\n/);
    expect(out).toMatch(/DESCRIPTION:Bus departs at 08:00\r\n/);
    expect(out).toMatch(/CATEGORIES:.*טיול/);
  });

  it("escapes special characters in text fields (comma, semicolon, backslash, newline)", () => {
    const out = serializeCalendar({
      schoolName: "S",
      schoolSlug: "s",
      events: [
        evt({
          title: "A, B; C\\D",
          description: "line one\nline two",
        }),
      ],
    });
    expect(out).toMatch(/SUMMARY:A\\, B\\; C\\\\D\r\n/);
    expect(out).toMatch(/DESCRIPTION:line one\\nline two\r\n/);
  });

  it("uses VALUE=DATE format for all-day events", () => {
    const out = serializeCalendar({
      schoolName: "S",
      schoolSlug: "s",
      events: [
        evt({
          allDay: true,
          startAt: new Date("2026-10-15T00:00:00.000Z"),
          endAt: new Date("2026-10-16T00:00:00.000Z"),
        }),
      ],
    });
    expect(out).toMatch(/DTSTART;VALUE=DATE:20261015\r\n/);
    expect(out).toMatch(/DTEND;VALUE=DATE:20261016\r\n/);
  });

  it("is deterministic for the same input (so ETag is stable)", () => {
    const a = serializeCalendar({
      schoolName: "S",
      schoolSlug: "s",
      events: [evt(), evt({ id: "22222222-2222-2222-2222-222222222222", title: "Exam" })],
    });
    const b = serializeCalendar({
      schoolName: "S",
      schoolSlug: "s",
      events: [evt(), evt({ id: "22222222-2222-2222-2222-222222222222", title: "Exam" })],
    });
    expect(a).toBe(b);
  });
});
