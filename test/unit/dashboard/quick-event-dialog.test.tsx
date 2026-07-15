import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickEventDialog } from "@/components/dashboard/QuickEventDialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("QuickEventDialog", () => {
  it("reveals the end date and locks all-day mode for a multi-day event", async () => {
    const user = userEvent.setup();
    render(
      <QuickEventDialog
        open
        dateIso="2026-07-14"
        eventTypes={[]}
        allowedGrades={[]}
        onClose={() => undefined}
        onPublished={() => undefined}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "multiDay" }));

    expect(screen.getByLabelText("endDate")).toHaveValue("2026-07-14");
    expect(screen.getByRole("checkbox", { name: "allDay" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "allDay" })).toBeDisabled();
  });

  it("selects every allowed grade with the select-all control", async () => {
    const user = userEvent.setup();
    render(
      <QuickEventDialog
        open
        dateIso="2026-07-14"
        eventTypes={[]}
        allowedGrades={[7, 9, 11]}
        onClose={() => undefined}
        onPublished={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "selectAll" }));

    for (const grade of [7, 9, 11]) {
      expect(screen.getByRole("button", { name: `label_${grade}` })).toHaveAttribute("aria-pressed", "true");
    }
  });
});
