import { describe, expect, it } from "vitest";
import {
  findCurrentAgendaWeekStart,
  findCurrentMonthStart,
  jerusalemDateKey,
} from "@/lib/views/current-period";
import type { AgendaWeek } from "@/lib/views/agenda-model";
import type { GanttMonth } from "@/lib/views/gantt";

const MONTHS: GanttMonth[] = [
  { startDate: "2026-09-01", monthIndex: 9, leftPct: 0, widthPct: 10 },
  { startDate: "2026-10-01", monthIndex: 10, leftPct: 10, widthPct: 10 },
  { startDate: "2026-11-01", monthIndex: 11, leftPct: 20, widthPct: 10 },
];

const WEEKS: AgendaWeek[] = [
  { weekStart: "2026-09-06", items: [] },
  { weekStart: "2026-09-13", items: [] },
  { weekStart: "2026-09-20", items: [] },
];

const WEEKS_WITH_GAP: AgendaWeek[] = [
  { weekStart: "2026-09-13", items: [] },
  { weekStart: "2026-09-20", items: [] },
];

describe("current period helpers", () => {
  it("formats today's key in Asia/Jerusalem", () => {
    expect(jerusalemDateKey(new Date("2026-09-14T21:30:00.000Z"))).toBe("2026-09-15");
  });

  it("finds the current month when today falls inside the rendered academic months", () => {
    expect(findCurrentMonthStart(MONTHS, new Date("2026-10-10T09:00:00.000Z"))).toBe("2026-10-01");
  });

  it("returns null when today is outside the rendered months", () => {
    expect(findCurrentMonthStart(MONTHS, new Date("2027-01-10T09:00:00.000Z"))).toBeNull();
  });

  it("finds the current agenda week from a Jerusalem-local date", () => {
    expect(findCurrentAgendaWeekStart(WEEKS, new Date("2026-09-15T09:00:00.000Z"))).toBe("2026-09-13");
  });

  it("falls forward to the next agenda week when the current week is not rendered", () => {
    expect(findCurrentAgendaWeekStart(WEEKS_WITH_GAP, new Date("2026-09-08T09:00:00.000Z"))).toBe("2026-09-13");
  });
});
