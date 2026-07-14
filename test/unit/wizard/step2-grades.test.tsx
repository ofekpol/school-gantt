import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Step2Grades } from "@/components/wizard/Step2Grades";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("Step2Grades", () => {
  it("submits exactly every allowed grade after select all", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn().mockResolvedValue(undefined);
    render(
      <Step2Grades
        data={{}}
        saving={false}
        allowedGrades={[7, 9, 11]}
        onNext={onNext}
        onBack={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "selectAll" }));
    await user.click(screen.getByRole("button", { name: "next" }));

    expect(onNext).toHaveBeenCalledWith({ grades: [7, 9, 11] });
  });
});
