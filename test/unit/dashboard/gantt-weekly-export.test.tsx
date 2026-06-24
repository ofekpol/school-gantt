import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GanttWeekly } from "@/components/Gantt/GanttWeekly";
import { buildWeeklyModel } from "@/lib/views/gantt-weekly";

const translations: Record<string, string> = {
  button: "ייצוא",
  shortButton: "ייצוא",
  modalTitle: "חיבור ל-Google Calendar",
  intro: "צור קישור פרטי ליומן עם כל האירועים שמותר לך לראות בבית הספר.",
  googleInstructions: "העתק את הקישור והוסף אותו ב-Google Calendar דרך הוספת יומן ← מכתובת URL.",
  syncNote: "Google Calendar מסתנכרן אוטומטית, אבל עדכונים עשויים להופיע רק אחרי כמה שעות.",
  createUrl: "צור קישור ליומן",
  creatingUrl: "יוצר קישור...",
  urlLabel: "קישור היומן שלך",
  copy: "העתק",
  copied: "הועתק",
  loginRequiredTitle: "צריך להתחבר",
  loginRequiredBody: "התחבר כדי ליצור קישור פרטי ל-Google Calendar.",
  loginAction: "התחברות",
  errorGeneric: "אירעה שגיאה",
  close: "סגור",
  mobileWeekList: "רשימת השבוע",
  mobileNewEventOnDate: "אירוע חדש",
  mobileNoEvents: "אין אירועים",
  weeklyPeriodNavigation: "weeklyPeriodNavigation",
  previousWeek: "שבוע קודם",
  nextWeek: "שבוע הבא",
  backToToday: "חזור להיום",
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === "weekLabel") return `שבוע ${values?.week ?? ""}`;
    return translations[key] ?? key;
  },
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("GanttWeekly export action", () => {
  it("opens the Google Calendar URL subscription modal from the toolbar export button", async () => {
    const user = userEvent.setup();
    const model = buildWeeklyModel(
      new Date(Date.UTC(2026, 6, 7)),
      [],
      [7, 8],
      new Date(Date.UTC(2026, 6, 7)),
    );

    render(
      <GanttWeekly
        model={model}
        events={[]}
        navigationMode="local"
      />,
    );

    await user.click(screen.getByRole("button", { name: "ייצוא" }));

    expect(screen.getByRole("dialog", { name: "חיבור ל-Google Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "צור קישור ליומן" })).toBeInTheDocument();
    expect(screen.queryByText("הורד קובץ ‎.ics")).not.toBeInTheDocument();
  });

  it("renders a mobile weekly list whose event buttons use the existing selection handler", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    const event = {
      id: "event-1",
      title: "Trip day",
      startAt: "2026-07-07T08:00:00.000Z",
      endAt: "2026-07-07T10:00:00.000Z",
      allDay: false,
      description: null,
      location: null,
      eventTypeId: "type-1",
      eventTypeKey: "trip",
      eventTypeLabelHe: "טיול",
      eventTypeColor: "#1f77b4",
      eventTypeGlyph: "T",
      grades: [7],
    };
    const model = buildWeeklyModel(
      new Date(Date.UTC(2026, 6, 7)),
      [{ ...event, startAt: new Date(event.startAt), endAt: new Date(event.endAt) }],
      [7, 8],
      new Date(Date.UTC(2026, 6, 7)),
    );

    render(
      <GanttWeekly
        model={model}
        events={[event]}
        navigationMode="local"
        onEventClick={onEventClick}
      />,
    );

    const mobileList = screen.getByLabelText("רשימת השבוע");
    await user.click(within(mobileList).getByRole("button", { name: "Trip day" }));

    expect(onEventClick).toHaveBeenCalledWith("event-1");
  });

  it("centers the weekly date label between previous and next week buttons", () => {
    const model = buildWeeklyModel(
      new Date(Date.UTC(2026, 6, 7)),
      [],
      [7, 8],
      new Date(Date.UTC(2026, 6, 7)),
    );

    render(<GanttWeekly model={model} events={[]} navigationMode="local" />);

    const nav = screen.getByLabelText("weeklyPeriodNavigation");
    expect(within(nav).getByRole("button", { name: "שבוע קודם" })).toHaveTextContent("‹");
    expect(within(nav).getByRole("heading", { name: "שבוע 7–13 ביולי" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "שבוע הבא" })).toHaveTextContent("›");
    expect(nav).toHaveClass("justify-center");
  });

  it("jumps from another week back to the current week", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T09:00:00.000Z"));
    window.history.replaceState(null, "", "/dashboard?week=2026-08-02&grades=7");
    const model = buildWeeklyModel(
      new Date(Date.UTC(2026, 7, 2)),
      [],
      [7, 8],
      new Date(Date.UTC(2026, 6, 8)),
    );

    render(<GanttWeekly model={model} events={[]} navigationMode="local" />);

    fireEvent.click(screen.getByRole("button", { name: "חזור להיום" }));

    expect(window.location.pathname).toBe("/dashboard");
    expect(window.location.search).toContain("week=2026-07-05");
    expect(window.location.search).toContain("grades=7");
  });
});
