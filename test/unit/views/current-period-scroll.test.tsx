import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgendaList } from "@/components/AgendaList";
import { GanttCanvas } from "@/components/Gantt/GanttCanvas";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import type { AgendaWeek } from "@/lib/views/agenda-model";
import type { CalendarChip, CalendarMonth } from "@/lib/views/calendar";
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
  cleanup();
  vi.useRealTimers();
});

describe("current period scrolling", () => {
  it("shows the current calendar month and switches months with arrows", async () => {
    render(
      <YearCalendarGrid
        months={[calendarMonth(9), calendarMonth(10), calendarMonth(11)]}
        yearLabel="2026"
        schoolName="Demo"
      />,
    );

    expect(screen.getByRole("heading", { name: "10 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "9 2026" })).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "previousMonth" }));

    expect(screen.getByRole("heading", { name: "9 2026" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "backToToday" }));

    expect(screen.getByRole("heading", { name: "10 2026" })).toBeInTheDocument();
  });

  it("opens a month-year picker from the month heading", () => {
    render(
      <YearCalendarGrid
        months={[
          calendarMonth(9),
          calendarMonth(10),
          calendarMonth(11),
          calendarMonth(12),
          calendarMonth(1, 2027),
        ]}
        yearLabel="2026-2027"
        schoolName="Demo"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "10 2026" }));

    expect(screen.getByRole("listbox", { name: "chooseMonth" })).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });

    fireEvent.click(screen.getByRole("option", { name: "1 2027" }));

    expect(screen.getByRole("heading", { name: "1 2027" })).toBeInTheDocument();
  });

  it("opens a new event from the monthly day cell when editing is allowed", () => {
    const onDayClick = vi.fn();
    render(
      <YearCalendarGrid
        months={[calendarMonthWithDay()]}
        yearLabel="2026"
        schoolName="Demo"
        onDayClick={onDayClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "newEventOnDate" }));

    expect(onDayClick).toHaveBeenCalledWith("2026-10-15");
  });

  it("keeps the calendar day hover treatment in read-only mode", () => {
    render(
      <YearCalendarGrid
        months={[calendarMonthWithDay()]}
        yearLabel="2026"
        schoolName="Demo"
      />,
    );

    expect(screen.getByText("15").closest(".calendar-day")).toHaveClass("hover:bg-blue-50");
  });

  it("marks today's date in the monthly calendar", () => {
    render(
      <YearCalendarGrid
        months={[calendarMonthWithDay()]}
        yearLabel="2026"
        schoolName="Demo"
      />,
    );

    expect(screen.getByText("15").closest("[aria-current='date']")).not.toBeNull();
  });

  it("opens an existing monthly event for editing without opening a new event", () => {
    const onDayClick = vi.fn();
    const onEventClick = vi.fn();
    render(
      <YearCalendarGrid
        months={[calendarMonthWithDay([calendarChip()])]}
        yearLabel="2026"
        schoolName="Demo"
        onDayClick={onDayClick}
        onEventClick={onEventClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "טיול" }));

    expect(onEventClick).toHaveBeenCalledWith("event-1");
    expect(onDayClick).not.toHaveBeenCalled();
  });

  it("shows the current agenda week and switches weeks with arrows", async () => {
    render(
      <AgendaList
        weeks={[agendaWeek("2026-10-11"), agendaWeek("2026-10-18")]}
        emptyLabel="empty"
      />,
    );

    expect(screen.getByRole("heading", { name: /11 באוק׳/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /18 באוק׳/ })).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "nextWeek" }));

    expect(screen.getByRole("heading", { name: /18 באוק׳/ })).toBeInTheDocument();
  });

  it("shows one agenda month at a time in monthly mode", () => {
    render(
      <AgendaList
        weeks={[agendaWeek("2026-10-11"), agendaWeek("2026-11-01")]}
        emptyLabel="empty"
        mode="month"
      />,
    );

    expect(screen.getByRole("heading", { name: "אוקטובר 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "נובמבר 2026" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "nextMonth" }));

    expect(screen.getByRole("heading", { name: "נובמבר 2026" })).toBeInTheDocument();
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

  it("opens event details above computed Gantt event layers", () => {
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

    const eventButton = screen.getByRole("button", { name: "טיול" });
    const eventZIndex = Number(eventButton.style.zIndex);

    fireEvent.click(eventButton);

    const dialog = screen.getByRole("dialog", { name: "טיול" });

    expect(Number(dialog.style.zIndex)).toBeGreaterThan(eventZIndex);
  });

  it("renders same-grade overlapping Gantt events in separate vertical lanes", () => {
    render(
      <GanttCanvas
        events={[
          eventItem("event-1", "טיול", "2026-10-15T09:00:00.000Z"),
          eventItem("event-2", "מבחן", "2026-10-15T09:00:00.000Z"),
        ]}
        bars={[
          bar({ id: "event-1", eventId: "event-1", title: "טיול", lane: 0, laneCount: 2 }),
          bar({ id: "event-2", eventId: "event-2", title: "מבחן", lane: 1, laneCount: 2 }),
        ]}
        months={[month(9), month(10), month(11)]}
        grades={[7]}
        zoom="month"
        emptyLabel="empty"
      />,
    );

    const firstTop = screen.getByRole("button", { name: "טיול" }).style.top;
    const secondTop = screen.getByRole("button", { name: "מבחן" }).style.top;

    expect(firstTop).not.toBe(secondTop);
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

function calendarMonth(monthIndex: number, year = 2026): CalendarMonth {
  return {
    year,
    monthIndex,
    weeks: [{ days: Array.from({ length: 7 }, () => null) }],
  };
}

function calendarMonthWithDay(events: CalendarChip[] = []) {
  return {
    year: 2026,
    monthIndex: 10,
    weeks: [
      {
        days: [
          null,
          {
            date: "2026-10-15",
            dayOfMonth: 15,
            weekday: 4,
            inMonth: true,
            events,
          },
          null,
          null,
          null,
          null,
          null,
        ],
      },
    ],
  } satisfies CalendarMonth;
}

function calendarChip() {
  return {
    id: "event-1",
    eventId: "event-1",
    title: "טיול",
    eventTypeKey: "trip",
    eventTypeLabelHe: "טיול",
    eventTypeColor: "#0ea5e9",
    eventTypeGlyph: "compass",
    grades: [7],
    status: "approved" as const,
    isCanceled: false,
    isUpdated: false,
  };
}

function agendaWeek(weekStart: string): AgendaWeek {
  return {
    weekStart,
    items: [event(`${weekStart}T09:00:00.000Z`)],
  };
}

function event(startAt = "2026-10-15T09:00:00.000Z") {
  return eventItem("event-1", "טיול", startAt);
}

function eventItem(id: string, title: string, startAt: string) {
  return {
    id,
    title,
    startAt: new Date(startAt),
    endAt: new Date(new Date(startAt).getTime() + 60 * 60 * 1000),
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

function bar(overrides: Partial<GanttBar> = {}): GanttBar {
  return {
    id: "event-1",
    eventId: "event-1",
    title: "טיול",
    leftPct: 10,
    widthPct: 10,
    rowStart: 0,
    rowSpan: 1,
    lane: 0,
    laneCount: 1,
    eventTypeKey: "trip",
    eventTypeLabelHe: "טיול",
    eventTypeColor: "#0ea5e9",
    eventTypeGlyph: "compass",
    ...overrides,
  };
}
