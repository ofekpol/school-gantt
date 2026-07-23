import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoadingPanel } from "@/components/LoadingPanel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (key === "loading" ? "Loading…" : key),
}));

describe("LoadingPanel", () => {
  it("pairs the loading status with an animated visual indicator", () => {
    render(<LoadingPanel />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });
});
