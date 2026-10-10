import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { buildCalendarModel } from "@/lib/views/calendar";
import { buildWeeklyModel } from "@/lib/views/gantt-weekly";
import { DEFAULT_GRADE_COLORS } from "@/lib/grade-colors";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.grade ? `${key} ${values.grade}` : key,
}));

vi.mock("@/components/Gantt/GanttWeekly", () => ({
  GanttWeekly: ({
    events,
    model,
    onEventClick,
  }: {
    events?: { id: string; title: string }[];
    model: { rows: { grade: number }[] };
    onEventClick?: (id: string) => void;
  }) => (
    <div aria-label="weekly rows">
      {model.rows.map((row) => (
        <div key={row.grade}>grade-{row.grade}</div>
      ))}
      {events?.map((event) => (
        <button key={event.id} type="button" onClick={() => onEventClick?.(event.id)}>
          {event.title}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/lib/views/calendar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/views/calendar")>();
  return { ...actual, buildCalendarModel: vi.fn(actual.buildCalendarModel) };
});

vi.mock("@/components/YearCalendarGrid", () => ({
  YearCalendarGrid: () => <div />,
}));

vi.mock("@/components/Gantt/EventDrawer", () => ({
  EventDrawer: ({
    event,
    onDismiss,
  }: {
    event: { id: string; title: string } | null;
    onDismiss?: () => Promise<boolean>;
  }) => (
    <div>
      {event && <div>{event.title}</div>}
      {onDismiss && (
        <button type="button" onClick={() => void onDismiss()}>
          dismiss
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/dashboard/QuickEventDialog", () => ({
  QuickEventDialog: () => <div />,
}));

const allGrades = [7, 8, 9, 10, 11, 12];

function renderWeekly(overrides: { canCreateEvents?: boolean } = {}) {
  const weeklyModel = buildWeeklyModel(
    new Date(Date.UTC(2026, 4, 24)),
    [],
    allGrades,
    new Date(Date.UTC(2026, 4, 25)),
  );
  return render(
    <DashboardCalendar
      view="weekly"
      weeklyModel={weeklyModel}
      events={[]}
      calendarRange={{ label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }}
      schoolName="Demo School"
      eventTypes={[]}
      allowedGrades={allGrades}
      selectedGrades={[]}
      gradeColors={DEFAULT_GRADE_COLORS}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/dashboard");
});

describe("DashboardCalendar grade filter", () => {
  it("keeps the calendar export action beside the view toggle in both views", async () => {
    const user = userEvent.setup();
    const weeklyModel = buildWeeklyModel(
      new Date(Date.UTC(2026, 4, 24)),
      [],
      allGrades,
      new Date(Date.UTC(2026, 4, 25)),
    );

    render(
      <DashboardCalendar
        view="weekly"
        weeklyModel={weeklyModel}
        events={[]}
        calendarRange={{ label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }}
        schoolName="Demo School"
        eventTypes={[]}
        allowedGrades={allGrades}
        selectedGrades={[]}
        gradeColors={DEFAULT_GRADE_COLORS}
      />,
    );

    expect(screen.getByRole("button", { name: "shortButton" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "viewMonthly" }));

    expect(screen.getByRole("button", { name: "shortButton" })).toBeInTheDocument();
  });

  it("adds and removes grades from the weekly focus without deselecting others", async () => {
    const user = userEvent.setup();
    renderWeekly();

    await user.click(screen.getByRole("button", { name: "gradeFilterOption ז" }));
    expect(screen.getByText("grade-7")).toBeInTheDocument();
    expect(screen.queryByText("grade-8")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "gradeFilterOption ח" }));
    expect(screen.getByText("grade-7")).toBeInTheDocument();
    expect(screen.getByText("grade-8")).toBeInTheDocument();
    expect(window.location.search).toBe("?grades=7&grades=8");

    await user.click(screen.getByRole("button", { name: "gradeFilterOption ז" }));
    expect(screen.queryByText("grade-7")).not.toBeInTheDocument();
    expect(screen.getByText("grade-8")).toBeInTheDocument();
  });

  it("shows every grade row when nothing is selected", () => {
    renderWeekly();

    for (const grade of allGrades) expect(screen.getByText(`grade-${grade}`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "selectAllGrades" })).not.toBeInTheDocument();
    expect(screen.getByText("gradeSelectionHint")).toBeInTheDocument();
  });
});

describe("DashboardCalendar read-only mode", () => {
  it("clears the grade focus back to every grade", async () => {
    const user = userEvent.setup();
    renderWeekly({ canCreateEvents: false });

    await user.click(screen.getByRole("button", { name: "gradeFilterOption ז" }));
    expect(screen.getByRole("button", { name: "gradeFilterOption ז" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "clearGradeSelection" }));

    expect(screen.getByRole("button", { name: "gradeFilterOption ז" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("grade-12")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(screen.queryByRole("button", { name: "newEvent" })).not.toBeInTheDocument();
  });

  it("hides event creation controls for viewers", () => {
    const weeklyModel = buildWeeklyModel(
      new Date(Date.UTC(2026, 4, 24)),
      [],
      allGrades,
      new Date(Date.UTC(2026, 4, 25)),
    );

    render(
      <DashboardCalendar
        view="weekly"
        weeklyModel={weeklyModel}
        events={[]}
        calendarRange={{ label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }}
        schoolName="Demo School"
        eventTypes={[]}
        allowedGrades={allGrades}
        selectedGrades={[]}
        gradeColors={DEFAULT_GRADE_COLORS}
        canCreateEvents={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "newEvent" })).not.toBeInTheDocument();
  });
});

describe("DashboardCalendar canceled event dismissal", () => {
  it("removes only the selected canceled event from the local dashboard after dismissal", async () => {
    const user = userEvent.setup();
    const weeklyModel = buildWeeklyModel(
      new Date(Date.UTC(2026, 4, 24)),
      [],
      allGrades,
      new Date(Date.UTC(2026, 4, 25)),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "dismissed" }), { status: 200 }),
    );

    render(
      <DashboardCalendar
        view="weekly"
        weeklyModel={weeklyModel}
        events={[
          {
            id: "evt-1",
            title: "Canceled event",
            startAt: "2026-05-25T08:00:00.000Z",
            endAt: "2026-05-25T09:00:00.000Z",
            allDay: false,
            description: null,
            location: null,
            eventTypeId: "type-1",
            eventTypeKey: "trip",
            eventTypeLabelHe: "טיול",
            eventTypeColor: "#dc2626",
            eventTypeGlyph: "T",
            grades: [7],
            status: "canceled",
            isCanceled: true,
            isUpdated: false,
            canEdit: false,
          },
        ]}
        calendarRange={{ label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }}
        schoolName="Demo School"
        eventTypes={[]}
        allowedGrades={allGrades}
        selectedGrades={[]}
        gradeColors={DEFAULT_GRADE_COLORS}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Canceled event" }));
    await user.click(screen.getByRole("button", { name: "dismiss" }));

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/v1/events/evt-1", { method: "DELETE" });
    expect(screen.queryByText("Canceled event")).not.toBeInTheDocument();
  });
});

describe("DashboardCalendar month grid cost", () => {
  it("builds the month grid only once the monthly view is shown", async () => {
    const user = userEvent.setup();
    vi.mocked(buildCalendarModel).mockClear();
    const weeklyModel = buildWeeklyModel(
      new Date(Date.UTC(2026, 4, 24)),
      [],
      allGrades,
      new Date(Date.UTC(2026, 4, 25)),
    );

    render(
      <DashboardCalendar
        view="weekly"
        weeklyModel={weeklyModel}
        events={[]}
        calendarRange={{ label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }}
        schoolName="Demo School"
        eventTypes={[]}
        allowedGrades={allGrades}
        selectedGrades={[]}
        gradeColors={DEFAULT_GRADE_COLORS}
      />,
    );

    expect(buildCalendarModel).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "viewMonthly" }));

    expect(buildCalendarModel).toHaveBeenCalledTimes(1);
  });
});
