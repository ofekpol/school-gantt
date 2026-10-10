import { describe, expect, it } from "vitest";
import { addCalendarDays, jerusalemOffset, jerusalemWallClockToIso } from "@/lib/datetime";

describe("jerusalemWallClockToIso", () => {
  it("uses +02:00 in winter (after the 25 Oct 2026 switch)", () => {
    expect(jerusalemWallClockToIso("2026-10-27", "00:00:00")).toBe("2026-10-27T00:00:00+02:00");
  });

  it("uses +03:00 in summer", () => {
    expect(jerusalemWallClockToIso("2026-09-10", "08:30")).toBe("2026-09-10T08:30:00+03:00");
  });

  it("resolves each side of the DST switch day correctly", () => {
    expect(jerusalemWallClockToIso("2026-10-24", "23:59:59")).toBe("2026-10-24T23:59:59+03:00");
    expect(jerusalemWallClockToIso("2026-10-25", "12:00")).toBe("2026-10-25T12:00:00+02:00");
    expect(jerusalemWallClockToIso("2027-03-27", "00:00:00")).toBe("2027-03-27T00:00:00+03:00");
  });

  it("always lands on local midnight for all-day starts", () => {
    for (const date of ["2026-09-01", "2026-10-27", "2027-01-15", "2027-04-20"]) {
      const iso = jerusalemWallClockToIso(date, "00:00:00");
      expect(jerusalemOffset(new Date(iso))).toBe(iso.slice(-6));
    }
  });
});

describe("addCalendarDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addCalendarDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
