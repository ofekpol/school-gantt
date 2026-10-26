import { describe, expect, it } from "vitest";
import { normalizeExtracted, type NormalizeContext } from "@/lib/ai/adder/normalize";
import type { ExtractedEvent } from "@/lib/ai/adder/types";

const TRIP = "11111111-1111-4111-8111-111111111111";
const EXAM = "22222222-2222-4222-8222-222222222222";

const ctx: NormalizeContext = {
  eventTypes: [
    { id: TRIP, key: "trip" },
    { id: EXAM, key: "exam" },
  ],
  allowedTypeIds: null,
  allowedGrades: [7, 8],
  today: "2026-10-27",
};

function ex(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return {
    title: "טיול שנתי",
    startDay: 12,
    startMonth: 11,
    startYear: 2026,
    endDay: null,
    endMonth: null,
    endYear: null,
    startTime: "08:00",
    endTime: "16:00",
    allDay: null,
    grades: [8],
    allGrades: false,
    eventTypeKey: "trip",
    typeConfident: true,
    location: null,
    description: null,
    recurring: false,
    ...overrides,
  };
}

const codes = (c: { warnings: { code: string }[] }) => c.warnings.map((w) => w.code);

describe("normalizeExtracted — dates", () => {
  it("full DMY date with 4-digit year", () => {
    const c = normalizeExtracted(ex(), ctx, "c1");
    expect(c.startDate).toBe("2026-11-12");
    expect(c.endDate).toBeNull();
    expect(c.warnings).toEqual([]);
    expect(c.clientId).toBe("c1");
  });

  it("2-digit year becomes 20xx", () => {
    const c = normalizeExtracted(ex({ startDay: 1, startMonth: 1, startYear: 27 }), ctx, "c");
    expect(c.startDate).toBe("2027-01-01");
  });

  it("day/month are never swapped: 3/12 is 3 December", () => {
    const c = normalizeExtracted(ex({ startDay: 3, startMonth: 12 }), ctx, "c");
    expect(c.startDate).toBe("2026-12-03");
  });

  it("missing year keeps hint, never infers", () => {
    const c = normalizeExtracted(ex({ startDay: 1, startMonth: 1, startYear: null }), ctx, "c");
    expect(c.startDate).toBeNull();
    expect(c.dateHint).toEqual({ day: 1, month: 1 });
    expect(codes(c)).toContain("missing_year");
  });

  it("missing day or month → missing_date", () => {
    const c = normalizeExtracted(ex({ startDay: null }), ctx, "c");
    expect(c.startDate).toBeNull();
    expect(c.dateHint).toBeNull();
    expect(codes(c)).toEqual(["missing_date"]);
  });

  it.each([
    [31, 4, 2026],
    [29, 2, 2027],
    [0, 5, 2026],
    [3, 13, 2026],
  ])("invalid %i/%i/%i → invalid_date", (d, m, y) => {
    const c = normalizeExtracted(ex({ startDay: d, startMonth: m, startYear: y }), ctx, "c");
    expect(c.startDate).toBeNull();
    expect(codes(c)).toEqual(["invalid_date"]);
  });

  it("multi-day range sets endDate, borrowing month/year from the end", () => {
    const c = normalizeExtracted(
      ex({ startMonth: null, startYear: null, endDay: 14, endMonth: 11, endYear: 26, allDay: true }),
      ctx,
      "c",
    );
    expect(c.startDate).toBe("2026-11-12");
    expect(c.endDate).toBe("2026-11-14");
    expect(c.warnings).toEqual([]);
  });

  it("end before start → invalid_date", () => {
    const c = normalizeExtracted(ex({ endDay: 10, endMonth: 11, endYear: 2026 }), ctx, "c");
    expect(codes(c)).toContain("invalid_date");
    expect(c.endDate).toBeNull();
  });
});

describe("normalizeExtracted — times", () => {
  it("start time without end time → missing_time, keeps startTime", () => {
    const c = normalizeExtracted(ex({ startTime: "10:00", endTime: null }), ctx, "c");
    expect(c.startTime).toBe("10:00");
    expect(c.endTime).toBeNull();
    expect(codes(c)).toEqual(["missing_time"]);
  });

  it("pads single-digit hours", () => {
    const c = normalizeExtracted(ex({ startTime: "8:00", endTime: "9:30" }), ctx, "c");
    expect([c.startTime, c.endTime]).toEqual(["08:00", "09:30"]);
  });

  it("allDay true needs no times", () => {
    const c = normalizeExtracted(ex({ allDay: true, startTime: null, endTime: null }), ctx, "c");
    expect(c.allDay).toBe(true);
    expect(c.warnings).toEqual([]);
  });

  it("no times and allDay null → missing_time (never defaults to all day)", () => {
    const c = normalizeExtracted(ex({ startTime: null, endTime: null }), ctx, "c");
    expect(c.allDay).toBeNull();
    expect(codes(c)).toEqual(["missing_time"]);
  });

  it("end time not after start on a single day → missing_time", () => {
    const c = normalizeExtracted(ex({ startTime: "11:00", endTime: "10:00" }), ctx, "c");
    expect(codes(c)).toEqual(["missing_time"]);
  });
});

describe("normalizeExtracted — grades, type, title", () => {
  it("allGrades expands to 7–12", () => {
    const c = normalizeExtracted(ex({ grades: [], allGrades: true }), ctx, "c");
    expect(c.grades).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("grades outside 7–12 are dropped; none left → missing_grades", () => {
    const c = normalizeExtracted(ex({ grades: [6, 13] }), ctx, "c");
    expect(c.grades).toEqual([]);
    expect(codes(c)).toEqual(["missing_grades"]);
  });

  it("grades outside editor scope → grade_out_of_scope, kept in list", () => {
    const c = normalizeExtracted(ex({ grades: [9, 8] }), ctx, "c");
    expect(c.grades).toEqual([8, 9]);
    expect(c.warnings).toEqual([{ code: "grade_out_of_scope", grades: [9] }]);
  });

  it("unknown eventTypeKey → eventTypeId null + uncertain_type", () => {
    const c = normalizeExtracted(ex({ eventTypeKey: "party" }), ctx, "c");
    expect(c.eventTypeId).toBeNull();
    expect(codes(c)).toEqual(["uncertain_type"]);
  });

  it("typeConfident false → eventTypeId null + uncertain_type", () => {
    const c = normalizeExtracted(ex({ typeConfident: false }), ctx, "c");
    expect(c.eventTypeId).toBeNull();
    expect(codes(c)).toEqual(["uncertain_type"]);
  });

  it("type not allowed for editor → null + uncertain_type", () => {
    const c = normalizeExtracted(ex(), { ...ctx, allowedTypeIds: new Set([EXAM]) }, "c");
    expect(c.eventTypeId).toBeNull();
    expect(codes(c)).toEqual(["uncertain_type"]);
  });

  it("known allowed type resolves to its id", () => {
    expect(normalizeExtracted(ex(), ctx, "c").eventTypeId).toBe(TRIP);
  });

  it("empty title → missing_title", () => {
    const c = normalizeExtracted(ex({ title: "   " }), ctx, "c");
    expect(codes(c)).toEqual(["missing_title"]);
  });

  it("recurring → recurring warning", () => {
    expect(codes(normalizeExtracted(ex({ recurring: true }), ctx, "c"))).toEqual(["recurring"]);
  });

  it("null location/description become empty strings", () => {
    const c = normalizeExtracted(ex(), ctx, "c");
    expect([c.location, c.description]).toEqual(["", ""]);
  });
});
