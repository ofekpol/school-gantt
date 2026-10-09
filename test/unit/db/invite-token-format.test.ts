import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  db: new Proxy({}, { get: () => { throw new Error("db must not be queried"); } }),
  withSchool: () => { throw new Error("db must not be queried"); },
}));

describe("getInviteByToken", () => {
  it("returns null for a malformed token without querying the uuid column", async () => {
    const { getInviteByToken } = await import("@/lib/db/invites");
    await expect(getInviteByToken("does-not-exist")).resolves.toBeNull();
    await expect(getInviteByToken("")).resolves.toBeNull();
  });
});
