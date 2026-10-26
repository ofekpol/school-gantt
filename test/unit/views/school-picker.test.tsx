import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SchoolPicker } from "@/components/public/SchoolPicker";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

describe("SchoolPicker", () => {
  it("renders one link per school to its read-only schedule", () => {
    render(
      <SchoolPicker
        schools={[
          { slug: "a", name: "School A" },
          { slug: "b", name: "School B" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "School A" }).getAttribute("href")).toBe("/schedule?school=a");
    expect(screen.getByRole("link", { name: "School B" }).getAttribute("href")).toBe("/schedule?school=b");
    expect(screen.getByRole("heading", { name: "title" })).toBeTruthy();
  });
});
