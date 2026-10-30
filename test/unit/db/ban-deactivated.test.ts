import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUserByIdMock = vi.fn();
vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => [{ id: "a" }, { id: "b" }, { id: "c" }] }) }),
  },
  supabaseAdmin: {
    auth: { admin: { updateUserById: (...args: unknown[]) => updateUserByIdMock(...args) } },
  },
}));

import { banDeactivatedStaff } from "@/lib/db/ban-deactivated";

describe("banDeactivatedStaff", () => {
  beforeEach(() => updateUserByIdMock.mockReset());

  it("bans every deactivated user and keeps going past a failure", async () => {
    updateUserByIdMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "boom" } })
      .mockResolvedValueOnce({ error: null });

    const result = await banDeactivatedStaff();

    expect(result).toEqual({ banned: ["a", "c"], failed: [{ id: "b", reason: "boom" }] });
    expect(updateUserByIdMock).toHaveBeenCalledWith("a", { ban_duration: "876000h" });
  });
});
