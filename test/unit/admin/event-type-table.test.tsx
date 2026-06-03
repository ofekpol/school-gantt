import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventTypeTable } from "@/components/admin/EventTypeTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const initial = [
  {
    id: "type-1",
    key: "ztrip",
    labelHe: "טיול",
    labelEn: "Trip",
    colorHex: "#1f77b4",
    glyph: "T",
  },
  {
    id: "type-2",
    key: "aexam",
    labelHe: "בחינה",
    labelEn: "Exam",
    colorHex: "#d62728",
    glyph: "E",
  },
  {
    id: "type-3",
    key: "mceremony",
    labelHe: "אסיפה",
    labelEn: "Assembly",
    colorHex: "#9467bd",
    glyph: "A",
  },
];

afterEach(() => cleanup());

function visibleRowTexts() {
  return screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[1].textContent);
}

describe("EventTypeTable sorting", () => {
  it("sorts by Hebrew label by default and hides display order", () => {
    render(<EventTypeTable initial={initial} />);

    expect(visibleRowTexts()).toEqual(["אסיפה", "בחינה", "טיול"]);
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
  });

  it("sorts by clickable text headers but not by color", async () => {
    const user = userEvent.setup();
    render(<EventTypeTable initial={initial} />);

    await user.click(screen.getByRole("button", { name: "key" }));
    expect(visibleRowTexts()).toEqual(["בחינה", "אסיפה", "טיול"]);

    await user.click(screen.getByRole("button", { name: "labelEn" }));
    expect(visibleRowTexts()).toEqual(["אסיפה", "בחינה", "טיול"]);

    expect(screen.queryByRole("button", { name: "colorHex" })).not.toBeInTheDocument();
  });
});
