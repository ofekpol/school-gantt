import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  FEED_FORMAT_REVISION,
  serializeCalendar,
  type ICalEvent,
} from "@/lib/ical/serializer";

function evt(overrides: Partial<ICalEvent> = {}): ICalEvent {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Trip",
    description: "Bus, 08:00; bring water\nand a hat",
    location: "Tiberias",
    startAt: new Date("2026-10-15T08:00:00.000Z"),
    endAt: new Date("2026-10-15T16:00:00.000Z"),
    allDay: false,
    eventTypeLabelHe: "טיול",
    updatedAt: new Date("2026-09-01T12:34:56.000Z"),
    version: 3,
    ...overrides,
  };
}

function serialize(events: ICalEvent[]): string {
  return serializeCalendar({ schoolName: "S", schoolSlug: "s", events });
}

describe("serializeCalendar change signals (so subscribed clients refresh)", () => {
  it("stamps DTSTAMP and LAST-MODIFIED from updatedAt, not from the event start", () => {
    const out = serialize([evt()]);
    expect(out).toMatch(/DTSTAMP:20260901T123456Z\r\n/);
    expect(out).toMatch(/LAST-MODIFIED:20260901T123456Z\r\n/);
  });

  it("emits SEQUENCE = event version + feed format revision", () => {
    const out = serialize([evt({ version: 3 })]);
    expect(out).toContain(`SEQUENCE:${3 + FEED_FORMAT_REVISION}\r\n`);
  });

  it("raises SEQUENCE when an edit bumps the event version", () => {
    const seq = (body: string) => Number(/SEQUENCE:(\d+)/.exec(body)![1]);
    expect(seq(serialize([evt({ version: 2 })]))).toBeGreaterThan(
      seq(serialize([evt({ version: 1 })])),
    );
  });

  it("emits change signals on all-day and canceled events too", () => {
    const out = serialize([
      evt({
        allDay: true,
        startAt: new Date("2026-10-26T22:00:00Z"),
        endAt: new Date("2026-10-27T21:59:59Z"),
        version: 1,
      }),
      evt({ id: "22222222-2222-2222-2222-222222222222", canceled: true, version: 2 }),
    ]);
    expect(out.match(/^SEQUENCE:/gm)).toHaveLength(2);
    expect(out.match(/^LAST-MODIFIED:/gm)).toHaveLength(2);
  });
});

/**
 * Guard: Google Calendar keeps its cached copy of an event unless SEQUENCE
 * rises. Any change to the serialized output (dates, fields, escaping) must
 * therefore bump FEED_FORMAT_REVISION so existing subscribers re-read every
 * event. If this test fails after you changed the serializer:
 *   1. bump FEED_FORMAT_REVISION in lib/ical/serializer.ts,
 *   2. ADD the new hash under the new revision below (never edit old entries).
 */
const OUTPUT_HASH_BY_REVISION: Record<number, string> = {
  1: "fc137704dad6a4ee",
};

describe("feed format revision guard", () => {
  it("output for the fixture matches the hash recorded for the current revision", () => {
    const body = serialize([
      evt(),
      evt({
        id: "33333333-3333-3333-3333-333333333333",
        allDay: true,
        startAt: new Date("2026-10-26T22:00:00Z"),
        endAt: new Date("2026-10-27T21:59:59Z"),
      }),
      evt({ id: "44444444-4444-4444-4444-444444444444", canceled: true, location: null }),
    ]);
    // SEQUENCE carries the revision itself; hash the rest of the format.
    const withoutSequence = body.replace(/^SEQUENCE:\d+\r\n/gm, "");
    const hash = createHash("sha256").update(withoutSequence).digest("hex").slice(0, 16);
    expect(hash).toBe(OUTPUT_HASH_BY_REVISION[FEED_FORMAT_REVISION]);
  });
});
