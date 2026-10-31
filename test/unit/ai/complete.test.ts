import { describe, expect, it } from "vitest";
import {
  candidateTimeRange,
  currentWarnings,
  isCandidateComplete,
  toPublishPayload,
} from "@/lib/ai/adder/complete";
import type { CandidateEvent } from "@/lib/ai/adder/types";

const TYPE = "11111111-1111-4111-8111-111111111111";

function cand(overrides: Partial<CandidateEvent> = {}): CandidateEvent {
  return {
    clientId: "c1",
    title: "טיול",
    startDate: "2026-11-12",
    endDate: null,
    dateHint: null,
    startTime: "08:00",
    endTime: "16:00",
    allDay: null,
    grades: [8],
    eventTypeId: TYPE,
    location: "",
    description: "",
    warnings: [],
    ...overrides,
  };
}

describe("isCandidateComplete", () => {
  it("complete timed event", () => {
    expect(isCandidateComplete(cand(), [7, 8])).toBe(true);
  });

  it("incomplete without grades in scope", () => {
    expect(isCandidateComplete(cand({ grades: [9] }), [7, 8])).toBe(false);
  });

  it("incomplete without a date, type, title or times", () => {
    expect(isCandidateComplete(cand({ startDate: null }), [8])).toBe(false);
    expect(isCandidateComplete(cand({ eventTypeId: null }), [8])).toBe(false);
    expect(isCandidateComplete(cand({ title: " " }), [8])).toBe(false);
    expect(isCandidateComplete(cand({ endTime: null }), [8])).toBe(false);
  });

  it("multi-day timed event may end earlier in the day than it starts", () => {
    expect(
      isCandidateComplete(cand({ endDate: "2026-11-14", startTime: "16:00", endTime: "10:00" }), [8]),
    ).toBe(true);
  });
});

describe("toPublishPayload", () => {
  it("complete all-day event → payload with Jerusalem 00:00:00/23:59:59", () => {
    const p = toPublishPayload(cand({ allDay: true, startTime: null, endTime: null }), [8]);
    expect(p.startAt).toBe("2026-11-12T00:00:00+02:00");
    expect(p.endAt).toBe("2026-11-12T23:59:59+02:00");
    expect(p.allDay).toBe(true);
  });

  it("payload drops out-of-scope grades and omits empty optionals", () => {
    const p = toPublishPayload(cand({ grades: [8, 9] }), [7, 8]);
    expect(p.grades).toEqual([8]);
    expect(p).not.toHaveProperty("location");
    expect(p).not.toHaveProperty("description");
    expect(p.eventTypeId).toBe(TYPE);
    expect(p.startAt).toBe("2026-11-12T08:00:00+02:00");
  });

  it("throws for an incomplete candidate", () => {
    expect(() => toPublishPayload(cand({ startDate: null }), [8])).toThrow("incomplete_candidate");
  });
});

describe("candidateTimeRange", () => {
  it("null when incomplete, range when timed", () => {
    expect(candidateTimeRange(cand({ startDate: null }))).toBeNull();
    expect(candidateTimeRange(cand())).toEqual({
      startAt: "2026-11-12T08:00:00+02:00",
      endAt: "2026-11-12T16:00:00+02:00",
    });
  });
});

describe("currentWarnings", () => {
  it("clears missing_year once startDate is filled", () => {
    const c = cand({ warnings: [{ code: "missing_year" }] });
    expect(currentWarnings(c, [8])).toEqual([]);
  });

  it("keeps the date warning while no date is set", () => {
    const c = cand({ startDate: null, warnings: [{ code: "missing_year" }] });
    expect(currentWarnings(c, [8]).map((w) => w.code)).toEqual(["missing_year"]);
  });

  it("keeps informational duplicate/overlap/recurring warnings", () => {
    const dup = { code: "duplicate" as const, eventId: "e", title: "t", date: "2026-11-12" };
    const c = cand({ warnings: [dup, { code: "recurring" }] });
    expect(currentWarnings(c, [8])).toEqual([dup, { code: "recurring" }]);
  });

  it("recomputes grade_out_of_scope from current grades", () => {
    const c = cand({ grades: [8, 9], warnings: [] });
    expect(currentWarnings(c, [7, 8])).toEqual([{ code: "grade_out_of_scope", grades: [9] }]);
  });

  it("flags fields the user emptied", () => {
    const c = cand({ grades: [], eventTypeId: null, endTime: null });
    expect(currentWarnings(c, [8]).map((w) => w.code)).toEqual([
      "missing_time",
      "missing_grades",
      "uncertain_type",
    ]);
  });
});
