import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { buildWeeklyModel } from "@/lib/views/gantt-weekly";

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DashboardCalendar grade filter", () => {
  it("removes deselected grades from the weekly rows immediately", async () => {
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
        months={[]}
        events={[]}
        calendarRange={{ label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }}
        schoolName="Demo School"
        eventTypes={[]}
        allowedGrades={allGrades}
        selectedGrades={allGrades}
      />,
    );

    await user.click(screen.getByRole("button", { name: "gradeFilterOption ז" }));

    expect(screen.queryByText("grade-7")).not.toBeInTheDocument();
    expect(screen.getByText("grade-8")).toBeInTheDocument();
  });
});

describe("DashboardCalendar read-only mode", () => {
  it("lets viewers restore every grade with the choose-all control", async () => {
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
        months={[]}
        events={[]}
        calendarRange={{ label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }}
        schoolName="Demo School"
        eventTypes={[]}
        allowedGrades={allGrades}
        selectedGrades={allGrades}
        canCreateEvents={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "gradeFilterOption ז" }));
    await user.click(screen.getByRole("button", { name: "selectAllGrades" }));

    expect(screen.getByRole("button", { name: "gradeFilterOption ז" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "clearAllGrades" }));

    expect(screen.getByRole("button", { name: "gradeFilterOption ז" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(window.location.search).toBe("?grades=none");
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
        months={[]}
        events={[]}
        calendarRange={{ label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }}
        schoolName="Demo School"
        eventTypes={[]}
        allowedGrades={allGrades}
        selectedGrades={allGrades}
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
        months={[]}
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
        selectedGrades={allGrades}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Canceled event" }));
    await user.click(screen.getByRole("button", { name: "dismiss" }));

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/v1/events/evt-1", { method: "DELETE" });
    expect(screen.queryByText("Canceled event")).not.toBeInTheDocument();
  });
});
