import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRADE_COLORS,
  GRADE_COLOR_OPTIONS,
  WHOLE_SCHOOL_COLOR,
  eventColorScheme,
  isEventInGradeSelection,
  isWholeSchoolEvent,
  resolveGradeColors,
  sortBySelection,
} from "@/lib/grade-colors";
import { calendarEventVisual } from "@/components/CalendarEventChip";

const ALL = [7, 8, 9, 10, 11, 12];

describe("resolveGradeColors", () => {
  it("fills unset grades with defaults and applies overrides", () => {
    const map = resolveGradeColors([{ grade: 9, colorHex: "#7A7A2E" }]);
    expect(map[9]).toBe("#7A7A2E");
    expect(map[7]).toBe(DEFAULT_GRADE_COLORS[7]);
  });

  it("ignores grades the school does not have", () => {
    const map = resolveGradeColors([{ grade: 3, colorHex: "#7A7A2E" }]);
    expect(map[3]).toBeUndefined();
  });

  it("offers every default color in the curated palette", () => {
    for (const color of Object.values(DEFAULT_GRADE_COLORS)) {
      expect(GRADE_COLOR_OPTIONS).toContain(color);
    }
  });
});

describe("eventColorScheme", () => {
  it("uses the grade color for single-grade events", () => {
    const scheme = eventColorScheme([8], DEFAULT_GRADE_COLORS);
    expect(scheme).toMatchObject({ kind: "single", fill: DEFAULT_GRADE_COLORS[8], dots: [] });
  });

  it("uses a neutral fill with one dot per grade for multi-grade events", () => {
    const scheme = eventColorScheme([9, 7], DEFAULT_GRADE_COLORS);
    expect(scheme.kind).toBe("multi");
    expect(scheme.fill).toBe("#ffffff");
    expect(scheme.dots).toEqual([DEFAULT_GRADE_COLORS[7], DEFAULT_GRADE_COLORS[9]]);
  });

  it("uses the whole-school color when every grade (or none) is included", () => {
    expect(eventColorScheme(ALL, DEFAULT_GRADE_COLORS).fill).toBe(WHOLE_SCHOOL_COLOR);
    expect(eventColorScheme([], DEFAULT_GRADE_COLORS).kind).toBe("school");
    expect(isWholeSchoolEvent(ALL)).toBe(true);
    expect(isWholeSchoolEvent([7, 8])).toBe(false);
  });
});

describe("grade selection focus", () => {
  it("highlights everything when nothing is selected", () => {
    expect(isEventInGradeSelection([7], [])).toBe(true);
  });

  it("highlights events sharing any selected grade, and whole-school events", () => {
    expect(isEventInGradeSelection([7, 8], [8, 10])).toBe(true);
    expect(isEventInGradeSelection([9], [8, 10])).toBe(false);
    expect(isEventInGradeSelection(ALL, [8])).toBe(true);
  });

  it("orders highlighted events first without mutating the input", () => {
    const events = [{ id: "a", grades: [9] }, { id: "b", grades: [8] }];
    expect(sortBySelection(events, [8]).map((e) => e.id)).toEqual(["b", "a"]);
    expect(events[0].id).toBe("a");
  });
});

describe("calendarEventVisual", () => {
  it("dims events outside the selection and drops their dots", () => {
    const visual = calendarEventVisual({ grades: [9, 10] }, DEFAULT_GRADE_COLORS, [7]);
    expect(visual.highlighted).toBe(false);
    expect(visual.dots).toEqual([]);
  });

  it("keeps the canceled treatment regardless of grade", () => {
    const visual = calendarEventVisual({ grades: [7], isCanceled: true }, DEFAULT_GRADE_COLORS, []);
    expect(visual.style.textDecoration).toBe("line-through");
  });

  it("paints single-grade chips with the grade color", () => {
    const visual = calendarEventVisual({ grades: [7] }, DEFAULT_GRADE_COLORS, []);
    expect(visual.style.backgroundColor).toBe(DEFAULT_GRADE_COLORS[7]);
  });
});
