import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PendingRequestsTable } from "@/components/admin/PendingRequestsTable";
import { StaffTable } from "@/components/admin/StaffTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const eventTypes = [
  { id: "type-1", key: "trip", labelHe: "טיול", labelEn: "Trip" },
  { id: "type-2", key: "test", labelHe: "מבחן", labelEn: "Test" },
];

afterEach(() => cleanup());

describe("admin staff role permissions", () => {
  it("hides scope controls while editing a viewer and shows them for an editor", async () => {
    const user = userEvent.setup();

    render(
      <StaffTable
        initialStaff={[
          {
            id: "staff-1",
            email: "viewer@test",
            fullName: "Viewer User",
            role: "viewer",
            deactivatedAt: null,
            gradeScopes: [],
            eventTypeScopes: [],
          },
        ]}
        eventTypes={eventTypes}
      />,
    );

    await user.click(screen.getByRole("button", { name: "edit" }));

    expect(screen.queryByText("gradeScopes")).not.toBeInTheDocument();
    expect(screen.queryByText("eventTypeScopes")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("role"), "editor");

    expect(screen.getByText("gradeScopes")).toBeInTheDocument();
    expect(screen.getByText("eventTypeScopes")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("role"), "viewer");

    expect(screen.queryByText("gradeScopes")).not.toBeInTheDocument();
    expect(screen.queryByText("eventTypeScopes")).not.toBeInTheDocument();
  });

  it("hides approval scope controls for the default viewer role", async () => {
    const user = userEvent.setup();

    render(
      <PendingRequestsTable
        pending={[
          {
            id: "pending-1",
            email: "pending@test",
            fullName: "Pending User",
            requestedAt: new Date("2026-05-26T08:00:00.000Z"),
          },
        ]}
        eventTypes={eventTypes}
      />,
    );

    await user.click(screen.getByRole("button", { name: "approve" }));

    expect(screen.queryByText("gradeScopes")).not.toBeInTheDocument();
    expect(screen.queryByText("eventTypeScopes")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("role"), "editor");

    expect(screen.getByText("gradeScopes")).toBeInTheDocument();
    expect(screen.getByText("eventTypeScopes")).toBeInTheDocument();
  });
});
