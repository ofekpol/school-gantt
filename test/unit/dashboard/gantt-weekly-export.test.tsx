import { cleanup, render, screen } from "@testing-library/react";
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
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => translations[key] ?? key,
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
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
});
