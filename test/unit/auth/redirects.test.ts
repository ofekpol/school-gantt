import { describe, it, expect } from "vitest";
import { authLinkQuery, safeRedirectPath } from "@/lib/auth/redirects";

describe("authLinkQuery", () => {
  it("carries both invite token and school", () => {
    expect(authLinkQuery("tok", "test-a")).toEqual({ token: "tok", school: "test-a" });
  });

  it("omits missing values", () => {
    expect(authLinkQuery(undefined, "test-a")).toEqual({ school: "test-a" });
    expect(authLinkQuery(undefined, undefined)).toEqual({});
  });
});

const ORIGIN = "https://app.example.com";

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/events/new?step=2", "/a/b#c"])("keeps same-origin path %s", (path) => {
    expect(safeRedirectPath(path, "/dashboard")).toBe(path);
  });

  it.each([
    null,
    "",
    "dashboard",
    "https://evil.com",
    "//evil.com",
    "//evil.com/dashboard",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "//[",
    "javascript:alert(1)",
  ])("falls back for unsafe value %s", (value) => {
    expect(safeRedirectPath(value, "/dashboard")).toBe("/dashboard");
  });

  it("never resolves to another origin", () => {
    for (const value of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/ok"]) {
      const target = new URL(safeRedirectPath(value, "/dashboard"), ORIGIN);
      expect(target.origin).toBe(ORIGIN);
    }
  });
});
