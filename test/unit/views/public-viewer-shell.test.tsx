import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicViewerShell } from "@/components/PublicViewerShell";
import type { PublicViewerEvent } from "@/lib/views/public-viewer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/demo-school",
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/Gantt/GanttCanvas", () => ({
  GanttCanvas: ({ grades }: { grades: number[] }) => (
    <div aria-label="gantt rows">
      {grades.map((grade) => (
        <div key={grade}>grade-{grade}</div>
      ))}
    </div>
  ),
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

vi.mock("@/components/AgendaList", () => ({
  AgendaList: () => <div />,
}));

vi.mock("@/components/YearCalendarGrid", () => ({
  YearCalendarGrid: () => <div />,
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => vi.fn(),
}));

const event: PublicViewerEvent = {
  id: "event-1",
  title: "טיול",
  startAt: "2026-09-15T06:00:00.000Z",
  endAt: "2026-09-15T09:00:00.000Z",
  allDay: false,
  description: null,
  location: null,
  eventTypeId: "type-1",
  eventTypeKey: "trip",
  eventTypeLabelHe: "טיול",
  eventTypeColor: "#0ea5e9",
  eventTypeGlyph: "compass",
  grades: [7, 8],
  status: "approved",
  isCanceled: false,
  isUpdated: false,
};

afterEach(() => {
  cleanup();
});

describe("PublicViewerShell grade filter", () => {
  it("removes deselected grades from the Gantt rows immediately", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/demo-school");

    render(
      <PublicViewerShell
        schoolSlug="demo-school"
        schoolName="Demo School"
        initialView="gantt"
        initialParams={{ grades: [], types: [], q: "", zoom: "year", week: null }}
        year={{ label: "2026", startDate: "2026-09-01", endDate: "2027-07-31" }}
        eventTypes={[{
          id: "type-1",
          key: "trip",
          labelHe: "טיול",
          labelEn: "Trip",
          colorHex: "#0ea5e9",
          glyph: "compass",
          sortOrder: 1,
        }]}
        initialEvents={[event]}
        initialEventsSignature="1:1:now"
      />,
    );

    await user.click(screen.getByRole("button", { name: "ז" }));

    expect(screen.queryByText("grade-7")).not.toBeInTheDocument();
    expect(screen.getByText("grade-8")).toBeInTheDocument();
  });
});

describe("PublicViewerShell zoom controls", () => {
  it("hides zoom controls on calendar view", () => {
    renderPublicViewer("calendar");

    expect(screen.queryByRole("radiogroup", { name: "זום" })).not.toBeInTheDocument();
  });

  it("limits agenda zoom controls to week and month", () => {
    renderPublicViewer("agenda");

    expect(screen.getByRole("radio", { name: "שבוע" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "חודש" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "סמסטר" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "שנה" })).not.toBeInTheDocument();
  });
});

function renderPublicViewer(initialView: "gantt" | "calendar" | "agenda") {
  window.history.replaceState(null, "", `/demo-school${initialView === "gantt" ? "" : `/${initialView}`}`);

  return render(
    <PublicViewerShell
      schoolSlug="demo-school"
      schoolName="Demo School"
      initialView={initialView}
      initialParams={{ grades: [], types: [], q: "", zoom: "year", week: null }}
      year={{ label: "2026", startDate: "2026-09-01", endDate: "2027-07-31" }}
      eventTypes={[{
        id: "type-1",
        key: "trip",
        labelHe: "טיול",
        labelEn: "Trip",
        colorHex: "#0ea5e9",
        glyph: "compass",
        sortOrder: 1,
      }]}
      initialEvents={[event]}
      initialEventsSignature="1:1:now"
    />,
  );
}
