import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExportToGoogleCalendarButton,
  type CalendarPrintOptions,
} from "@/components/ExportToGoogleCalendarButton";
import type { CalendarMonth } from "@/lib/views/calendar";

const translations: Record<string, string> = {
  button: "Export to Google Calendar",
  exportTitle: "Export calendar",
  googleCalendar: "Google Calendar",
  printCalendar: "Print calendar",
  printTitle: "Print calendar",
  chooseMonthToPrint: "Choose a month to print",
  printMode: "Print mode",
  color: "Print in color",
  blackAndWhite: "Black and white",
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const printMonths: CalendarMonth[] = [
  {
    year: 2026,
    monthIndex: 7,
    weeks: [
      {
        days: [
          {
            date: "2026-07-01",
            dayOfMonth: 1,
            weekday: 3,
            inMonth: true,
            events: [
              {
                id: "chip-1",
                eventId: "event-1",
                title: "School trip",
                eventTypeKey: "trip",
                eventTypeLabelHe: "טיול",
                eventTypeColor: "#1f77b4",
                eventTypeGlyph: "T",
                grades: [9],
              },
            ],
          },
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        segments: [],
        laneCount: 0,
      },
    ],
  },
];

const printCalendar: CalendarPrintOptions = {
  months: printMonths,
  schoolName: "Demo School",
  yearLabel: "2026",
};

function renderButton(options: { printCalendar?: CalendarPrintOptions } = {}) {
  return render(
    <ExportToGoogleCalendarButton
      schoolSlug="demo-school"
      allGrades={[7, 8, 9]}
      eventTypes={[
        {
          key: "trip",
          labelHe: "Trip",
          colorHex: "#0ea5e9",
        },
      ]}
      defaultGrades={[9]}
      defaultTypes={["trip"]}
      printCalendar={options.printCalendar}
    />,
  );
}

describe("ExportToGoogleCalendarButton", () => {
  it("offers calendar printing from the export choices", async () => {
    const user = userEvent.setup();

    renderButton({ printCalendar });
    await user.click(screen.getByRole("button", { name: "Export to Google Calendar" }));

    expect(screen.getByRole("button", { name: "Print calendar" })).toBeInTheDocument();
  });

  it("requests the print calendar only after Print is selected", async () => {
    const user = userEvent.setup();
    const loadPrintCalendar = vi.fn().mockResolvedValue(printCalendar);

    render(
      <ExportToGoogleCalendarButton
        schoolSlug="demo-school"
        loadPrintCalendar={loadPrintCalendar}
      />,
    );

    expect(loadPrintCalendar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Export to Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Print calendar" }));

    expect(loadPrintCalendar).toHaveBeenCalledOnce();
    expect(await screen.findByRole("radio", { name: "Print in color" })).toBeChecked();
  });

  it("prints the selected month in black and white", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);

    renderButton({ printCalendar });
    await user.click(screen.getByRole("button", { name: "Export to Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Print calendar" }));
    expect(screen.getByRole("radio", { name: "Print in color" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Black and white" }));
    await user.click(screen.getByRole("button", { name: "Print" }));

    expect(document.body).toHaveAttribute("data-print-mode", "monochrome");
    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "School trip" })).toHaveAttribute(
      "data-event-type",
      "trip",
    );

    window.dispatchEvent(new Event("afterprint"));
    expect(document.body).not.toHaveAttribute("data-print-mode");
  });

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
    await user.click(screen.getByRole("button", { name: "Export to Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Create calendar URL" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/ical-subscriptions/personal", {
      method: "POST",
    });
    expect(
      await screen.findByDisplayValue("https://app.example.test/ical/token-123"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("shows login guidance when the personal subscription endpoint returns 401", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false });

    renderButton();
    await user.click(screen.getByRole("button", { name: "Export to Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Create calendar URL" }));

    expect(await screen.findByText("Sign in required")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/auth/login?next=%2Fdemo-school%2Fcalendar%3Fgrades%3D9");
  });
});
