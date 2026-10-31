import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cand, eventTypes, fakeT } from "./adder-fixtures";

vi.mock("next-intl", () => ({ useTranslations: () => fakeT }));

import { SmartAdderCard } from "@/components/ai/SmartAdderCard";

function renderCard(overrides = {}, props: Partial<Parameters<typeof SmartAdderCard>[0]> = {}) {
  const onChange = vi.fn();
  const onCheckedChange = vi.fn();
  render(
    <SmartAdderCard
      candidate={cand(overrides)}
      eventTypes={eventTypes}
      allowedGrades={[7, 8]}
      checked={false}
      onCheckedChange={onCheckedChange}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, onCheckedChange };
}

afterEach(() => {
  cleanup();
});

describe("SmartAdderCard", () => {
  it("shows a Hebrew warning line per current warning", () => {
    renderCard({ grades: [], eventTypeId: null });
    expect(screen.getByText("warnings.missing_grades")).toBeInTheDocument();
    expect(screen.getByText("warnings.uncertain_type")).toBeInTheDocument();
  });

  it("checkbox is disabled while required fields are missing", () => {
    renderCard({ grades: [] });
    expect(screen.getByRole("checkbox", { name: /include/ })).toBeDisabled();
  });

  it("editing grades and saving reports the updated candidate", async () => {
    const user = userEvent.setup();
    const { onChange } = renderCard({ grades: [] });
    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.click(screen.getByRole("button", { name: "label_8" }));
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ grades: [8] }));
  });

  it("cancelling an edit discards changes", async () => {
    const user = userEvent.setup();
    const { onChange } = renderCard();
    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.clear(screen.getByLabelText("fields.title"));
    await user.click(screen.getByRole("button", { name: "cancelEdit" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("טיול שנתי")).toBeInTheDocument();
  });

  it("duplicate warning links to the existing event in the calendar", () => {
    renderCard({ warnings: [{ code: "duplicate", eventId: "e1", title: "טיול שנתי", date: "2026-11-12" }] });
    const link = screen.getByRole("link", { name: "openExisting" });
    expect(link).toHaveAttribute("href", "/dashboard?week=2026-11-08&event=e1");
  });

  it("out-of-scope grade is rendered struck through", () => {
    renderCard({ grades: [8, 9] });
    expect(screen.getByText("label_9")).toHaveAttribute("data-out-of-scope", "true");
    expect(screen.getByText("label_8")).not.toHaveAttribute("data-out-of-scope");
  });

  it("missing year shows the day/month hint", () => {
    renderCard({ startDate: null, dateHint: { day: 1, month: 1 }, warnings: [{ code: "missing_year" }] });
    expect(screen.getByText('dateHint{"date":"01/01"}')).toBeInTheDocument();
  });
});
