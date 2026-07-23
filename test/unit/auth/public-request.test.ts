import { describe, expect, it } from "vitest";
import { shouldBypassAuthRefresh } from "@/lib/auth/public-request";

describe("shouldBypassAuthRefresh", () => {
  it("bypasses middleware auth refresh for public viewer paths", () => {
    expect(shouldBypassAuthRefresh("/demo-school/calendar")).toBe(true);
  });

  it("keeps the root and staff routes behind middleware authentication", () => {
    expect(shouldBypassAuthRefresh("/")).toBe(false);
    expect(shouldBypassAuthRefresh("/dashboard")).toBe(false);
  });
});
