import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportToGoogleCalendarButton } from "@/components/ExportToGoogleCalendarButton";
import { buildCalendarModel } from "@/lib/views/calendar";

const translations: Record<string, string> = {
  button: "Export",
  exportTitle: "Export calendar",
  googleCalendar: "Google Calendar",
  printCalendar: "Print calendar",
  printTitle: "Print calendar",
  chooseMonthToPrint: "Choose a month to print",
  print: "Print",
  modalTitle: "Connect Google Calendar",
  intro: "Create a private calendar URL for all events you are allowed to see.",
  googleInstructions: "Add it in Google Calendar using Add calendar → From URL.",
  syncNote: "Google Calendar updates automatically, but changes may take several hours to appear.",
  createUrl: "Create calendar URL",
  creatingUrl: "Creating...",
  close: "Close",
  copy: "Copy",
  copied: "Copied",
  loginRequiredTitle: "Sign in required",
  loginRequiredBody: "Sign in to create your private Google Calendar URL.",
  loginAction: "Sign in",
  errorGeneric: "Something went wrong",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => translations[key] ?? key,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
  window.history.replaceState(null, "", "/demo-school/calendar?grades=9");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderButton() {
  const printMonths = buildCalendarModel({
    year: { startDate: "2026-09-01", endDate: "2026-09-30" },
    events: [{
      id: "event-1",
      title: "Staff meeting",
      startAt: new Date("2026-09-15T08:00:00.000Z"),
      endAt: new Date("2026-09-15T09:00:00.000Z"),
      allDay: false,
      grades: [9],
      eventTypeKey: "meeting",
      eventTypeLabelHe: "Meeting",
      eventTypeColor: "#0ea5e9",
      eventTypeGlyph: "M",
    }],
  }).months;

  return render(
    <ExportToGoogleCalendarButton
      schoolSlug="demo-school"
      allGrades={[7, 8, 9]}
      eventTypes={[{
        key: "trip",
        labelHe: "Trip",
        colorHex: "#0ea5e9",
      }]}
      defaultGrades={[9]}
      defaultTypes={["trip"]}
      printCalendar={{ months: printMonths, schoolName: "Demo School", yearLabel: "2026" }}
    />,
  );
}

describe("ExportToGoogleCalendarButton", () => {
  it("creates a personal iCal URL and offers copy", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      status: 201,
      ok: true,
      json: async () => ({
        id: "sub-1",
        url: "https://app.example.test/ical/token-123",
      }),
    });

    renderButton();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("button", { name: "Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Create calendar URL" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/ical-subscriptions/personal", {
      method: "POST",
    });
    expect(await screen.findByDisplayValue("https://app.example.test/ical/token-123")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("shows login guidance when the personal subscription endpoint returns 401", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false });

    renderButton();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("button", { name: "Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Create calendar URL" }));

    expect(await screen.findByText("Sign in required")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute(
      "href",
      "/auth/login?next=%2Fdemo-school%2Fcalendar%3Fgrades%3D9",
    );
  });

  it("prints only the month selected from the export picker", async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    vi.stubGlobal("print", print);

    renderButton();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("button", { name: "Print calendar" }));

    expect(screen.getByRole("dialog", { name: "Print calendar" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Choose a month to print" })).toHaveValue("0");

    await user.click(screen.getByRole("button", { name: "Print" }));

    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByText("Staff meeting")).toBeInTheDocument();
    window.dispatchEvent(new Event("afterprint"));
  });
});
