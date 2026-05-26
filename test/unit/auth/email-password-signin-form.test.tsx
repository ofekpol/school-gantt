import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailPasswordSignInForm } from "@/components/auth/EmailPasswordSignInForm";

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

describe("EmailPasswordSignInForm", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ status: "ok", redirectTo: "/dashboard" }, { status: 200 }),
      ),
    );
  });

  it("refreshes server-rendered state after a successful sign in", async () => {
    const user = userEvent.setup();

    render(<EmailPasswordSignInForm />);

    await user.type(screen.getByLabelText("אימייל"), "admin@demo-school.test");
    await user.type(screen.getByLabelText("סיסמה"), "ChangeMe123!");
    await user.click(screen.getByRole("button", { name: "כניסה" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
