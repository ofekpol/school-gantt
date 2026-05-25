import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  GanttWeekly: ({ model }: { model: { rows: { grade: number }[] } }) => (
    <div aria-label="weekly rows">
      {model.rows.map((row) => (
        <div key={row.grade}>grade-{row.grade}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/YearCalendarGrid", () => ({
  YearCalendarGrid: () => <div />,
}));

vi.mock("@/components/Gantt/EventDrawer", () => ({
  EventDrawer: () => <div />,
}));

vi.mock("@/components/dashboard/QuickEventDialog", () => ({
  QuickEventDialog: () => <div />,
}));

const allGrades = [7, 8, 9, 10, 11, 12];

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
        yearLabel="2026"
        schoolName="Demo School"
        yearBounds={null}
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
