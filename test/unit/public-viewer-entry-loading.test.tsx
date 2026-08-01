import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicViewerEntryLoading } from "@/components/PublicViewerEntryLoading";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      title: "Preparing your school calendar",
      detail: "Loading upcoming events…",
    };
    return messages[key] ?? key;
  },
}));

describe("PublicViewerEntryLoading", () => {
  it("announces loading while keeping its decorative calendar hidden", () => {
    render(<PublicViewerEntryLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Preparing your school calendar");
    expect(screen.getByText("Loading upcoming events…")).toBeInTheDocument();
    expect(screen.getByTestId("public-viewer-entry-visual")).toHaveAttribute("aria-hidden", "true");
  });
});
