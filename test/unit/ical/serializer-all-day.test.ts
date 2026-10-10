import { describe, expect, it } from "vitest";
import { serializeCalendar, type ICalEvent } from "@/lib/ical/serializer";

function allDay(startAt: string, endAt: string): ICalEvent {
  return {
    id: "evt-1",
    title: "בחירות לכנסת ישראל",
    description: null,
    location: null,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    allDay: true,
    eventTypeLabelHe: "חג",
    updatedAt: new Date(startAt),
  };
}

function dates(evt: ICalEvent): { start: string; end: string } {
  const body = serializeCalendar({ schoolName: "s", schoolSlug: "s", events: [evt] });
  return {
    start: /DTSTART;VALUE=DATE:(\d{8})/.exec(body)![1],
    end: /DTEND;VALUE=DATE:(\d{8})/.exec(body)![1],
  };
}

describe("serializeCalendar all-day dates (Asia/Jerusalem)", () => {
  it("27 Oct 2026 (winter time, UTC+2) exports as 27 Oct with exclusive end 28 Oct", () => {
    // Production row: local midnight 27 Oct → 23:59:59 27 Oct.
    expect(dates(allDay("2026-10-26T22:00:00Z", "2026-10-27T21:59:59Z"))).toEqual({
      start: "20261027",
      end: "20261028",
    });
  });

  it("summer-time (UTC+3) single day exports on the same calendar day", () => {
    // 10 Sep 2026 00:00 → 23:59:59 local, IDT.
    expect(dates(allDay("2026-09-09T21:00:00Z", "2026-09-10T20:59:59Z"))).toEqual({
      start: "20260910",
      end: "20260911",
    });
  });

  it("multi-day event spanning the DST change keeps both ends", () => {
    // 24 Oct (IDT) 00:00 → 26 Oct (IST) 23:59:59.
    expect(dates(allDay("2026-10-23T21:00:00Z", "2026-10-26T21:59:59Z"))).toEqual({
      start: "20261024",
      end: "20261027",
    });
  });
});
