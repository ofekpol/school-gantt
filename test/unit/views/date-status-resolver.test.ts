import { describe, expect, it } from "vitest";
import {
  createCalendarDateStatusResolver,
  eventJerusalemDateRange,
  jerusalemDateKey,
  type CalendarDateStatusDetail,
  type CalendarStatusEvent,
} from "@/lib/views/date-status";

/**
 * Verbatim copy of the original per-day implementation (every call re-filtered
 * all events and re-formatted their dates). The resolver must agree with it on
 * every input; it exists only to prove the optimisation did not change behaviour.
 */
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  weekday: "short",
});

function legacyDetail(date: Date, events: CalendarStatusEvent[]): CalendarDateStatusDetail {
  const dateKey = jerusalemDateKey(date);
  const canceled = (e: CalendarStatusEvent) => e.isCanceled === true || e.status === "canceled";
  const touches = (e: CalendarStatusEvent) => {
    if (e.endAt <= e.startAt) return false;
    const first = jerusalemDateKey(e.startAt);
    const last = jerusalemDateKey(new Date(e.endAt.getTime() - 1));
    return first <= dateKey && dateKey <= last;
  };
  const kind = (e: CalendarStatusEvent, k: string) => e.eventTypeKey.split(/[-_.]/).includes(k);
  const closures = events.filter((e) => !canceled(e) && touches(e));
  const holiday = closures.find((e) => kind(e, "holiday"));
  if (holiday) return { status: "holiday", closureColor: holiday.eventTypeColor };
  const vacation = closures.find((e) => kind(e, "vacation"));
  if (vacation) return { status: "vacation", closureColor: vacation.eventTypeColor };
  const weekday = weekdayFormatter.format(date);
  return { status: weekday === "Fri" || weekday === "Sat" ? "weekend" : "normal" };
}

/** Small deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPE_KEYS = [
  "holiday",
  "vacation",
  "bridge-vacation",
  "national_holiday",
  "holiday.vacation",
  "holidays", // not a closure: token must match exactly
  "exam",
  "trip",
  "general",
];
const HOUR = 3_600_000;
const DURATIONS_MS = [-HOUR, 0, 1, 90 * 60_000, 24 * HOUR, 25 * HOUR, 72 * HOUR, 15 * 24 * HOUR];
// 2026-08-20 .. 2027-09-15 spans both Israeli DST transitions (Oct 25 2026, Mar 26 2027).
const RANGE_START = Date.UTC(2026, 7, 20);
const RANGE_DAYS = 392;

function randomEvents(rand: () => number, count: number): CalendarStatusEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const day = Math.floor(rand() * RANGE_DAYS);
    // Mix of arbitrary half-hours and instants adjacent to Jerusalem midnight (21:00/22:00 UTC).
    const offsets = [0, 21 * HOUR, 22 * HOUR, 22 * HOUR - 1, 22 * HOUR + 1, Math.floor(rand() * 48) * 30 * 60_000];
    const startMs = RANGE_START + day * 24 * HOUR + offsets[Math.floor(rand() * offsets.length)];
    const duration = DURATIONS_MS[Math.floor(rand() * DURATIONS_MS.length)];
    const flavour = rand();
    return {
      eventTypeKey: TYPE_KEYS[Math.floor(rand() * TYPE_KEYS.length)],
      eventTypeColor: `#${(i + 1).toString(16).padStart(6, "0")}`,
      startAt: new Date(startMs),
      endAt: new Date(startMs + duration),
      isCanceled: flavour < 0.1 ? true : undefined,
      status: flavour > 0.9 ? "canceled" : "approved",
    };
  });
}

function probeInstants(): Date[] {
  const probes: Date[] = [];
  for (let day = -3; day < RANGE_DAYS + 3; day++) {
    const base = RANGE_START + day * 24 * HOUR;
    for (const offset of [12 * HOUR, 21 * HOUR, 22 * HOUR - 1, 22 * HOUR]) {
      probes.push(new Date(base + offset));
    }
  }
  return probes;
}

describe("createCalendarDateStatusResolver", () => {
  it("matches the original per-day implementation on randomized events", () => {
    const probes = probeInstants();
    for (const seed of [1, 2, 3]) {
      const events = randomEvents(mulberry32(seed), 30);
      const resolve = createCalendarDateStatusResolver(events);
      for (const instant of probes) {
        expect(resolve(instant), `seed=${seed} at ${instant.toISOString()}`).toEqual(
          legacyDetail(instant, events),
        );
      }
    }
  }, 30_000);

  it("matches when there are no events at all", () => {
    const resolve = createCalendarDateStatusResolver([]);
    for (const instant of probeInstants()) {
      expect(resolve(instant)).toEqual(legacyDetail(instant, []));
    }
  });

  it("lets the first holiday win over an earlier-listed vacation and uses its color", () => {
    const span = { startAt: new Date("2026-09-08T00:00:00Z"), endAt: new Date("2026-09-10T00:00:00Z") };
    const resolve = createCalendarDateStatusResolver([
      { ...span, eventTypeKey: "vacation", eventTypeColor: "#v1" },
      { ...span, eventTypeKey: "holiday", eventTypeColor: "#h1" },
      { ...span, eventTypeKey: "holiday", eventTypeColor: "#h2" },
    ]);
    expect(resolve(new Date("2026-09-08T12:00:00Z"))).toEqual({
      status: "holiday",
      closureColor: "#h1",
    });
  });

  it("does not let an event ending exactly at Jerusalem midnight touch the next day", () => {
    // 2026-09-08 00:00 Jerusalem (UTC+3 in September) = 2026-09-07T21:00Z.
    const resolve = createCalendarDateStatusResolver([
      {
        eventTypeKey: "holiday",
        eventTypeColor: "#h",
        startAt: new Date("2026-09-06T21:00:00Z"),
        endAt: new Date("2026-09-07T21:00:00Z"),
      },
    ]);
    expect(resolve(new Date("2026-09-07T12:00:00Z")).status).toBe("holiday");
    expect(resolve(new Date("2026-09-08T12:00:00Z")).status).toBe("normal");
  });
});

describe("eventJerusalemDateRange", () => {
  it("returns null for empty or inverted spans", () => {
    const at = new Date("2026-09-08T10:00:00Z");
    expect(eventJerusalemDateRange({ startAt: at, endAt: at })).toBeNull();
    expect(eventJerusalemDateRange({ startAt: at, endAt: new Date(at.getTime() - 1) })).toBeNull();
  });

  it("uses Jerusalem-local dates, not UTC dates", () => {
    // 23:30Z is already the next day in Jerusalem.
    expect(
      eventJerusalemDateRange({
        startAt: new Date("2026-09-07T23:30:00Z"),
        endAt: new Date("2026-09-08T00:30:00Z"),
      }),
    ).toEqual({ startDate: "2026-09-08", endDate: "2026-09-08" });
  });
});
