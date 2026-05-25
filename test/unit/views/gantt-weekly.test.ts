import { describe, expect, it } from "vitest";
import {
  buildWeeklyModel,
  getWeekStart,
  parseWeekParam,
  HEBREW_GRADE_LABELS,
  WEEK_DAY_END_HOUR,
  WEEK_DAY_START_HOUR,
} from "@/lib/views/gantt-weekly";
import type { AgendaItem } from "@/lib/views/agenda-model";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Sun 15 Nov 2026 – Sat 21 Nov 2026 (UTC midnight)
const WEEK_START = new Date(Date.UTC(2026, 10, 15));

// Wednesday 18 Nov 2026 noon UTC — used as "today" so days[3] gets isToday=true
const TODAY = new Date("2026-11-18T12:00:00Z");

function makeEvent(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "ev1",
    title: "Test event",
    // default: all-day Tuesday Nov 17, covers only day 2 of the week
    startAt: new Date(Date.UTC(2026, 10, 17)),
    endAt: new Date(Date.UTC(2026, 10, 18)),
    allDay: true,
    description: null,
    location: null,
    eventTypeKey: "trip",
    eventTypeLabelHe: "טיול",
    eventTypeColor: "#ff0000",
    eventTypeGlyph: "T",
    grades: [9],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getWeekStart
// ─────────────────────────────────────────────────────────────────────────────

describe("getWeekStart: returns Sunday of the containing week (Asia/Jerusalem)", () => {
  it("Wednesday → preceding Sunday", () => {
    // 2026-11-18 Wednesday noon UTC = Wednesday 14:00 Jerusalem (UTC+2)
    const result = getWeekStart(new Date("2026-11-18T12:00:00Z"));
    expect(result).toEqual(new Date(Date.UTC(2026, 10, 15))); // Nov 15
  });

  it("Sunday → same day", () => {
    const result = getWeekStart(new Date("2026-11-15T12:00:00Z"));
    expect(result).toEqual(new Date(Date.UTC(2026, 10, 15)));
  });

  it("Saturday → preceding Sunday", () => {
    const result = getWeekStart(new Date("2026-11-21T12:00:00Z"));
    expect(result).toEqual(new Date(Date.UTC(2026, 10, 15)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseWeekParam
// ─────────────────────────────────────────────────────────────────────────────

describe("parseWeekParam: parses YYYY-MM-DD string or falls back to current week", () => {
  it("valid YYYY-MM-DD string → UTC midnight Date", () => {
    expect(parseWeekParam("2026-11-15")).toEqual(new Date(Date.UTC(2026, 10, 15)));
  });

  it("undefined → returns a Date (current week start)", () => {
    expect(parseWeekParam(undefined)).toBeInstanceOf(Date);
  });

  it("invalid string → falls back and returns a Date", () => {
    expect(parseWeekParam("not-a-date")).toBeInstanceOf(Date);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWeeklyModel — days array
// ─────────────────────────────────────────────────────────────────────────────

describe("buildWeeklyModel: days array structure", () => {
  const model = buildWeeklyModel(WEEK_START, [], [9], TODAY);

  it("generates exactly 7 days", () => {
    expect(model.days).toHaveLength(7);
  });

  it("day indices run 0–6", () => {
    model.days.forEach((d, i) => expect(d.dayIndex).toBe(i));
  });

  it("Sunday (day 0) has correct mono name and Hebrew name", () => {
    expect(model.days[0].monoName).toBe("SUN");
    expect(model.days[0].hebrewName).toBe("ראשון");
  });

  it("Saturday (day 6) has correct mono name", () => {
    expect(model.days[6].monoName).toBe("SAT");
  });

  it("Friday and Saturday are weekends, Sunday is not", () => {
    expect(model.days[5].isWeekend).toBe(true); // Friday
    expect(model.days[6].isWeekend).toBe(true); // Saturday
    expect(model.days[0].isWeekend).toBe(false); // Sunday
  });

  it("isToday is true only for Wednesday (day 3) when today=Nov 18", () => {
    expect(model.days[3].isToday).toBe(true);
    const others = model.days.filter((_, i) => i !== 3);
    others.forEach((d) => expect(d.isToday).toBe(false));
  });

  it("weekStart and weekEnd are 7 days apart", () => {
    expect(model.weekStart).toEqual(WEEK_START);
    expect(model.weekEnd.getTime() - model.weekStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWeeklyModel — rows and grade labels
// ─────────────────────────────────────────────────────────────────────────────

describe("buildWeeklyModel: rows structure", () => {
  it("one row per grade in the supplied grades array", () => {
    const model = buildWeeklyModel(WEEK_START, [], [9, 10, 11], TODAY);
    expect(model.rows).toHaveLength(3);
    expect(model.rows.map((r) => r.grade)).toEqual([9, 10, 11]);
  });

  it("each row has the correct Hebrew grade label", () => {
    const model = buildWeeklyModel(WEEK_START, [], [7, 12], TODAY);
    expect(model.rows[0].hebrewLabel).toBe(HEBREW_GRADE_LABELS[7]); // "ז"
    expect(model.rows[1].hebrewLabel).toBe(HEBREW_GRADE_LABELS[12]); // "יב"
  });

  it("empty events list → all rows have zero bars", () => {
    const model = buildWeeklyModel(WEEK_START, [], [9, 10], TODAY);
    model.rows.forEach((r) => expect(r.bars).toHaveLength(0));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWeeklyModel — event positioning
// ─────────────────────────────────────────────────────────────────────────────

describe("buildWeeklyModel: event positioning and day indices", () => {
  it("all-day event on Tuesday occupies day 2, starts at 2/7 of week width", () => {
    // startAt Nov 17 UTC midnight = day 2; endAt Nov 18 = day 3 exclusive
    const model = buildWeeklyModel(WEEK_START, [makeEvent()], [9], TODAY);
    const bar = model.rows[0].bars[0];
    expect(bar.dayStart).toBe(2);
    expect(bar.dayEnd).toBe(2);
    // startPct for all-day at WEEK_DAY_START_HOUR on day 2 = (2/7)*100
    expect(bar.startPct).toBeCloseTo((2 / 7) * 100, 0);
    // widthPct for a single all-day column = (1/7)*100
    expect(bar.widthPct).toBeCloseTo((1 / 7) * 100, 0);
  });

  it("timed event hour offset shifts startPct within the day column", () => {
    // 10:00 Jerusalem = 08:00 UTC on Nov 17 (UTC+2 in Nov); within = (10-7)/14 = 3/14
    const event = makeEvent({
      startAt: new Date("2026-11-17T08:00:00Z"), // 10:00 Jerusalem
      endAt: new Date("2026-11-17T10:00:00Z"),   // 12:00 Jerusalem
      allDay: false,
    });
    const model = buildWeeklyModel(WEEK_START, [event], [9], TODAY);
    const bar = model.rows[0].bars[0];
    // Day 2, hour 10 → startPct = ((2 + (10-7)/14) / 7) * 100 ≈ 31.6%
    // Must be greater than the plain day-2 boundary (2/7*100 ≈ 28.6%)
    expect(bar.startPct).toBeGreaterThan((2 / 7) * 100);
    // Must still be within day 2's column
    expect(bar.startPct).toBeLessThan((3 / 7) * 100);
  });

  it("event bar id is prefixed with eventId and grade", () => {
    const event = makeEvent({ id: "evt-abc", grades: [9] });
    const model = buildWeeklyModel(WEEK_START, [event], [9], TODAY);
    expect(model.rows[0].bars[0].id).toBe("evt-abc-9");
    expect(model.rows[0].bars[0].eventId).toBe("evt-abc");
  });

  it("event fully before the week is excluded", () => {
    const event = makeEvent({
      startAt: new Date(Date.UTC(2026, 10, 10)), // Nov 10
      endAt: new Date(Date.UTC(2026, 10, 15)),   // Nov 15 = weekStart (exclusive: endAt <= weekStart)
    });
    const model = buildWeeklyModel(WEEK_START, [event], [9], TODAY);
    expect(model.rows[0].bars).toHaveLength(0);
  });

  it("event fully after the week is excluded", () => {
    const event = makeEvent({
      startAt: new Date(Date.UTC(2026, 10, 22)), // Nov 22 = weekEnd
      endAt: new Date(Date.UTC(2026, 10, 23)),
    });
    const model = buildWeeklyModel(WEEK_START, [event], [9], TODAY);
    expect(model.rows[0].bars).toHaveLength(0);
  });

  it("event spanning week start is clamped — bar starts at day 0", () => {
    // Starts Nov 10 (before week), ends Nov 17 (all-day: last day is Nov 16 Monday)
    const event = makeEvent({
      startAt: new Date(Date.UTC(2026, 10, 10)),
      endAt: new Date(Date.UTC(2026, 10, 17)), // Nov 17 UTC midnight = day 2 boundary
    });
    const model = buildWeeklyModel(WEEK_START, [event], [9], TODAY);
    expect(model.rows[0].bars).toHaveLength(1);
    expect(model.rows[0].bars[0].dayStart).toBe(0); // clamped to Sunday
    expect(model.rows[0].bars[0].startPct).toBeCloseTo(0, 0);
  });

  it("event spanning week end is clamped — bar ends at day 6", () => {
    // Starts Nov 19 Thursday, ends Nov 25 (after week)
    const event = makeEvent({
      startAt: new Date(Date.UTC(2026, 10, 19)),
      endAt: new Date(Date.UTC(2026, 10, 25)),
    });
    const model = buildWeeklyModel(WEEK_START, [event], [9], TODAY);
    expect(model.rows[0].bars).toHaveLength(1);
    expect(model.rows[0].bars[0].dayEnd).toBe(6); // clamped to Saturday
  });

  it("multi-day event spanning Tuesday–Thursday has dayStart=2, dayEnd=3", () => {
    // Nov 17 (Tue) → Nov 19 (Thu) exclusive → covers Tue + Wed
    const event = makeEvent({
      startAt: new Date(Date.UTC(2026, 10, 17)),
      endAt: new Date(Date.UTC(2026, 10, 19)), // exclusive, so dayEnd = Tue+Wed = 2..3
    });
    const model = buildWeeklyModel(WEEK_START, [event], [9], TODAY);
    const bar = model.rows[0].bars[0];
    expect(bar.dayStart).toBe(2);
    expect(bar.dayEnd).toBe(3);
  });

  it("event appears in each grade row it belongs to, not in others", () => {
    const event = makeEvent({ grades: [9, 10] });
    const model = buildWeeklyModel(WEEK_START, [event], [9, 10, 11], TODAY);
    expect(model.rows[0].bars).toHaveLength(1); // grade 9
    expect(model.rows[1].bars).toHaveLength(1); // grade 10
    expect(model.rows[2].bars).toHaveLength(0); // grade 11 — no bar
  });

  it("event for a grade absent from the grades list produces no bars", () => {
    const event = makeEvent({ grades: [8] }); // grade 8 not in [9, 10]
    const model = buildWeeklyModel(WEEK_START, [event], [9, 10], TODAY);
    model.rows.forEach((r) => expect(r.bars).toHaveLength(0));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWeeklyModel — lane assignment
// ─────────────────────────────────────────────────────────────────────────────

describe("buildWeeklyModel: lane assignment for collision avoidance", () => {
  it("two overlapping events on the same day get different lanes", () => {
    // Both on Tuesday; event2 starts while event1 is still running
    const event1 = makeEvent({
      id: "e1",
      startAt: new Date("2026-11-17T07:00:00Z"), // 09:00 Jerusalem
      endAt:   new Date("2026-11-17T09:00:00Z"), // 11:00 Jerusalem
      allDay: false,
    });
    const event2 = makeEvent({
      id: "e2",
      startAt: new Date("2026-11-17T08:00:00Z"), // 10:00 Jerusalem (overlaps)
      endAt:   new Date("2026-11-17T10:00:00Z"), // 12:00 Jerusalem
      allDay: false,
    });
    const model = buildWeeklyModel(WEEK_START, [event1, event2], [9], TODAY);
    const bars = model.rows[0].bars;
    expect(bars).toHaveLength(2);
    expect(bars[0].lane).not.toBe(bars[1].lane);
  });

  it("two non-overlapping events on different days share lane 0", () => {
    // event1 = Sunday all-day; event2 = Thursday all-day — no overlap
    const event1 = makeEvent({
      id: "e1",
      startAt: new Date(Date.UTC(2026, 10, 15)), // Sunday
      endAt:   new Date(Date.UTC(2026, 10, 16)),
    });
    const event2 = makeEvent({
      id: "e2",
      startAt: new Date(Date.UTC(2026, 10, 19)), // Thursday
      endAt:   new Date(Date.UTC(2026, 10, 20)),
    });
    const model = buildWeeklyModel(WEEK_START, [event1, event2], [9], TODAY);
    const bars = model.rows[0].bars;
    expect(bars).toHaveLength(2);
    expect(bars[0].lane).toBe(0);
    expect(bars[1].lane).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWeeklyModel — week label
// ─────────────────────────────────────────────────────────────────────────────

describe("buildWeeklyModel: week label", () => {
  it("label contains the start and end day-of-month numbers", () => {
    const model = buildWeeklyModel(WEEK_START, [], [9], TODAY);
    expect(model.weekLabel).toContain("15");
    expect(model.weekLabel).toContain("21");
  });

  it("label contains the Hebrew month name", () => {
    // November in Hebrew is "נובמבר"
    const model = buildWeeklyModel(WEEK_START, [], [9], TODAY);
    expect(model.weekLabel).toContain("נובמבר");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported constants
// ─────────────────────────────────────────────────────────────────────────────

describe("exported constants", () => {
  it("WEEK_DAY_START_HOUR is 7, WEEK_DAY_END_HOUR is 21", () => {
    expect(WEEK_DAY_START_HOUR).toBe(7);
    expect(WEEK_DAY_END_HOUR).toBe(21);
  });

  it("HEBREW_GRADE_LABELS covers grades 7–12", () => {
    for (let g = 7; g <= 12; g++) {
      expect(HEBREW_GRADE_LABELS[g]).toBeDefined();
      expect(typeof HEBREW_GRADE_LABELS[g]).toBe("string");
    }
  });
});
