import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(cleanup);

describe("PublicViewerEntryLoading", () => {
  it("announces loading while keeping its decorative calendar hidden", () => {
    render(<PublicViewerEntryLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Preparing your school calendar");
    expect(screen.getByText("Loading upcoming events…")).toBeInTheDocument();
    expect(screen.getByTestId("public-viewer-entry-visual")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the public entry panel as the school route loading boundary", async () => {
    const Loading = (await import("@/app/(viewer)/[school]/loading")).default;
    render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent("Preparing your school calendar");
  });
});
