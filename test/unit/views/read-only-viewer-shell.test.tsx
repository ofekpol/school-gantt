import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadOnlyViewerShell } from "@/components/ReadOnlyViewerShell";
import type { PublicViewerEvent } from "@/lib/views/public-viewer";
import he from "@/messages/he.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/schedule",
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => vi.fn(),
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

vi.mock("@/components/YearCalendarGrid", () => ({
  YearCalendarGrid: () => <div data-testid="year-calendar-grid" />,
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

function renderShell() {
  return render(
    <ReadOnlyViewerShell
      schoolSlug="demo-school"
      schoolName="Demo School"
      initialParams={{ grades: [], types: [], q: "", zoom: "year", week: null }}
      year={{ label: "2026", startDate: "2026-09-01", endDate: "2027-07-31" }}
      eventTypes={[
        {
          id: "type-1",
          key: "trip",
          labelHe: "טיול",
          labelEn: "Trip",
          colorHex: "#0ea5e9",
          glyph: "compass",
          sortOrder: 1,
        },
      ]}
      initialEvents={[event]}
      initialEventsSignature="1:1:now"
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("ReadOnlyViewerShell", () => {
  it("shows exactly a weekly and a monthly tab — no agenda", () => {
    renderShell();
    expect(screen.getByRole("button", { name: "weekly" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "monthly" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "agenda" })).not.toBeInTheDocument();
  });

  it("hides the zoom radiogroup entirely", () => {
    renderShell();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("has no export-to-Google-Calendar affordance", () => {
    renderShell();
    expect(screen.queryByText(/ייצוא/)).not.toBeInTheDocument();
    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
  });

  it("links the header login button straight to /auth/login", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "login" })).toHaveAttribute("href", "/auth/login");
  });

  it("removes deselected grades from the Weekly rows immediately", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "ז" }));

    expect(screen.queryByText("grade-7")).not.toBeInTheDocument();
    expect(screen.getByText("grade-8")).toBeInTheDocument();
  });

  it("switches to the monthly tab and renders the calendar grid", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "monthly" }));

    await waitFor(() => {
      expect(screen.getByTestId("year-calendar-grid")).toBeInTheDocument();
    });
  });
});

describe("ReadOnlyViewerShell i18n values", () => {
  it("ships the expected Hebrew copy for the schedule namespace", () => {
    expect(he.schedule.weekly).toBe("שבועי");
    expect(he.schedule.monthly).toBe("חודשי");
    expect(he.schedule.login).toBe("התחברות");
  });

  it("ships the expected Hebrew copy for the login page's no-auth schedule link", () => {
    const loginPageSource = readFileSync(
      join(process.cwd(), "app/auth/login/page.tsx"),
      "utf-8",
    );
    expect(loginPageSource).toContain("צפייה בלוח בלי להתחבר");
  });
});
