import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadOnlyViewerShell } from "@/components/ReadOnlyViewerShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/schedule",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    key === "weekLabel" ? `week ${values?.week ?? ""}` : key,
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => vi.fn(),
}));

vi.mock("@/components/YearCalendarGrid", () => ({
  YearCalendarGrid: () => <div />,
}));

const SIGNATURE = "1:1:now";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T09:00:00.000Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ signature: SIGNATURE }), { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("ReadOnlyViewerShell weekly tab polling", () => {
  it("stays on the paged-to week through background polls that find no changes", async () => {
    render(
      <ReadOnlyViewerShell
        accessToken="demo-school"
        schoolName="Demo School"
        initialParams={{ grades: [], types: [], q: "", zoom: "year", week: null }}
        year={{ label: "2026", startDate: "2026-09-01", endDate: "2027-07-31" }}
        eventTypes={[]}
        initialEvents={[]}
        initialEventsSignature={SIGNATURE}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "weekly" }));
    const nav = screen.getByLabelText("weeklyPeriodNavigation");
    const currentWeekHeading = within(nav).getByRole("heading").textContent;

    fireEvent.click(within(nav).getByRole("button", { name: "nextWeek" }));
    fireEvent.click(within(nav).getByRole("button", { name: "nextWeek" }));
    const pagedHeading = within(nav).getByRole("heading").textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(fetch).toHaveBeenCalled();
    expect(pagedHeading).not.toBe(currentWeekHeading);
    expect(within(nav).getByRole("heading").textContent).toBe(pagedHeading);
  });
});
