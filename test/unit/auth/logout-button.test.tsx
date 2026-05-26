import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "@/components/auth/LogoutButton";

const replaceMock = vi.fn();
const refreshMock = vi.fn();
const startRouteProgressMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => startRouteProgressMock,
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    startRouteProgressMock.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  it("logs out through the server route before returning to login", async () => {
    const user = userEvent.setup();

    render(<LogoutButton label="Logout" />);

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/v1/auth/logout", { method: "POST" });
    });
    expect(startRouteProgressMock).toHaveBeenCalledOnce();
    expect(replaceMock).toHaveBeenCalledWith("/auth/login");
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
