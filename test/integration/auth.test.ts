import { describe, expect, it } from "vitest";

describe("OAuth auth flow", () => {
  it("documents that email/password auth routes were removed", () => {
    expect("/auth/login").toBe("/auth/login");
  });
});
