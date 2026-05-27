import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AgendaList } from "@/components/AgendaList";
import { GanttCanvas } from "@/components/Gantt/GanttCanvas";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import type { AgendaWeek } from "@/lib/views/agenda-model";
import type { CalendarMonth } from "@/lib/views/calendar";
import type { GanttBar, GanttMonth } from "@/lib/views/gantt";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) =>
    values?.count === undefined ? key : `${key}:${values.count}`,
}));

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T09:00:00.000Z"));
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("current period scrolling", () => {
  it("scrolls the yearly calendar to the current month", () => {
    render(
      <YearCalendarGrid
        months={[calendarMonth(9), calendarMonth(10), calendarMonth(11)]}
        yearLabel="2026"
        schoolName="Demo"
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
  });

  it("scrolls the agenda to the current or next rendered week", () => {
    render(
      <AgendaList
        weeks={[agendaWeek("2026-10-11"), agendaWeek("2026-10-18")]}
        emptyLabel="empty"
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
  });

  it("scrolls the non-week Gantt timeline to the current month", () => {
    render(
      <GanttCanvas
        events={[event()]}
        bars={[bar()]}
        months={[month(9), month(10), month(11)]}
        grades={[7]}
        zoom="month"
        emptyLabel="empty"
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ inline: "center", block: "nearest", behavior: "auto" });
  });
});

function month(monthIndex: number): GanttMonth {
  return {
    startDate: `2026-${String(monthIndex).padStart(2, "0")}-01`,
    monthIndex,
    leftPct: (monthIndex - 9) * 10,
    widthPct: 10,
  };
}

function calendarMonth(monthIndex: number): CalendarMonth {
  return {
    year: 2026,
    monthIndex,
    weeks: [{ days: Array.from({ length: 7 }, () => null) }],
  };
}

function agendaWeek(weekStart: string): AgendaWeek {
  return {
    weekStart,
    items: [event()],
  };
}

function event() {
  return {
    id: "event-1",
    title: "טיול",
    startAt: new Date("2026-10-15T09:00:00.000Z"),
    endAt: new Date("2026-10-15T10:00:00.000Z"),
    allDay: false,
    description: null,
    location: null,
    eventTypeKey: "trip",
    eventTypeLabelHe: "טיול",
    eventTypeColor: "#0ea5e9",
    eventTypeGlyph: "compass",
    grades: [7],
  };
}

function bar(): GanttBar {
  return {
    id: "event-1",
    eventId: "event-1",
    title: "טיול",
    leftPct: 10,
    widthPct: 10,
    rowStart: 0,
    rowSpan: 1,
    eventTypeKey: "trip",
    eventTypeLabelHe: "טיול",
    eventTypeColor: "#0ea5e9",
    eventTypeGlyph: "compass",
  };
}
