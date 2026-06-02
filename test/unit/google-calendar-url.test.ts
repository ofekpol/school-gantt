import { describe, it, expect } from "vitest";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar-url";

/**
 * Google Calendar quick-add template URL builder.
 *
 * Contract (https://calendar.google.com/calendar/render?action=TEMPLATE):
 *   - all-day: dates=YYYYMMDD/YYYYMMDD, end exclusive (day after last day),
 *     calendar day resolved in Asia/Jerusalem (not UTC).
 *   - timed:   dates=YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ (UTC) + ctz=Asia/Jerusalem.
 */

function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("buildGoogleCalendarUrl", () => {
  it("targets the TEMPLATE render endpoint", () => {
    const url = buildGoogleCalendarUrl({
      title: "x",
      start: new Date("2026-05-20T08:00:00+03:00"),
      end: new Date("2026-05-20T10:00:00+03:00"),
      allDay: false,
    });
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    expect(params(url).get("action")).toBe("TEMPLATE");
  });

  describe("all-day events", () => {
    it("single day → dates=DAY/NEXT-DAY (exclusive end)", () => {
      const url = buildGoogleCalendarUrl({
        title: "טיול",
        // stored as Jerusalem-local midnight..end-of-day per EventDrawer
        start: new Date("2026-06-15T00:00:00+03:00"),
        end: new Date("2026-06-15T23:59:59+03:00"),
        allDay: true,
      });
      expect(params(url).get("dates")).toBe("20260615/20260616");
      expect(params(url).get("ctz")).toBeNull(); // ctz irrelevant for date-only
    });

    it("multi-day → end = last day + 1", () => {
      const url = buildGoogleCalendarUrl({
        title: "מחנה",
        start: new Date("2026-06-15T00:00:00+03:00"),
        end: new Date("2026-06-18T23:59:59+03:00"),
        allDay: true,
      });
      expect(params(url).get("dates")).toBe("20260615/20260619");
    });

    it("resolves the calendar day in Asia/Jerusalem, not UTC", () => {
      // 2026-06-15T00:00:00+03:00 == 2026-06-14T21:00:00Z. A UTC-based
      // formatter would wrongly yield 20260614; Jerusalem yields 20260615.
      const url = buildGoogleCalendarUrl({
        title: "x",
        start: new Date("2026-06-15T00:00:00+03:00"),
        end: new Date("2026-06-15T23:59:59+03:00"),
        allDay: true,
      });
      expect(params(url).get("dates")).toBe("20260615/20260616");
    });

    it("crosses a month boundary on the exclusive end", () => {
      const url = buildGoogleCalendarUrl({
        title: "x",
        start: new Date("2026-06-30T00:00:00+03:00"),
        end: new Date("2026-06-30T23:59:59+03:00"),
        allDay: true,
      });
      expect(params(url).get("dates")).toBe("20260630/20260701");
    });
  });

  describe("timed events", () => {
    it("emits UTC instants with ctz=Asia/Jerusalem (summer, +03:00)", () => {
      const url = buildGoogleCalendarUrl({
        title: "x",
        start: new Date("2026-07-01T09:00:00+03:00"), // 06:00:00Z
        end: new Date("2026-07-01T10:30:00+03:00"), // 07:30:00Z
        allDay: false,
      });
      expect(params(url).get("dates")).toBe("20260701T060000Z/20260701T073000Z");
      expect(params(url).get("ctz")).toBe("Asia/Jerusalem");
    });

    it("handles winter offset (+02:00) correctly", () => {
      const url = buildGoogleCalendarUrl({
        title: "x",
        start: new Date("2026-01-10T09:00:00+02:00"), // 07:00:00Z
        end: new Date("2026-01-10T10:00:00+02:00"), // 08:00:00Z
        allDay: false,
      });
      expect(params(url).get("dates")).toBe("20260110T070000Z/20260110T080000Z");
      expect(params(url).get("ctz")).toBe("Asia/Jerusalem");
    });

    it("preserves the absolute instant across the spring DST transition", () => {
      // Israel DST 2026 begins 2026-03-27. An event just after the switch is
      // +03:00; the UTC instant must reflect that, independent of host tz.
      const url = buildGoogleCalendarUrl({
        title: "x",
        start: new Date("2026-03-28T12:00:00+03:00"), // 09:00:00Z
        end: new Date("2026-03-28T13:00:00+03:00"), // 10:00:00Z
        allDay: false,
      });
      expect(params(url).get("dates")).toBe("20260328T090000Z/20260328T100000Z");
    });
  });

  describe("text fields", () => {
    it("sets text to the title", () => {
      const url = buildGoogleCalendarUrl({
        title: "טיול לכנרת",
        start: new Date("2026-05-20T08:00:00+03:00"),
        end: new Date("2026-05-20T10:00:00+03:00"),
        allDay: false,
      });
      expect(params(url).get("text")).toBe("טיול לכנרת");
    });

    it("url-encodes special characters in the title", () => {
      const url = buildGoogleCalendarUrl({
        title: "Math & Science: review",
        start: new Date("2026-05-20T08:00:00+03:00"),
        end: new Date("2026-05-20T10:00:00+03:00"),
        allDay: false,
      });
      // Decoded value round-trips; raw query escapes the ampersand.
      expect(params(url).get("text")).toBe("Math & Science: review");
      expect(url).toContain("Math+%26+Science");
    });

    it("includes details and location when present", () => {
      const url = buildGoogleCalendarUrl({
        title: "x",
        start: new Date("2026-05-20T08:00:00+03:00"),
        end: new Date("2026-05-20T10:00:00+03:00"),
        allDay: false,
        description: "Bring a hat",
        location: "Main hall",
      });
      expect(params(url).get("details")).toBe("Bring a hat");
      expect(params(url).get("location")).toBe("Main hall");
    });

    it("omits details and location when absent", () => {
      const url = buildGoogleCalendarUrl({
        title: "x",
        start: new Date("2026-05-20T08:00:00+03:00"),
        end: new Date("2026-05-20T10:00:00+03:00"),
        allDay: false,
      });
      expect(params(url).has("details")).toBe(false);
      expect(params(url).has("location")).toBe(false);
    });
  });
});
