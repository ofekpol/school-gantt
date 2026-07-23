import { describe, expect, it } from "vitest";
import { shouldBypassAuthRefresh } from "@/lib/auth/public-request";

describe("shouldBypassAuthRefresh", () => {
  it("bypasses middleware auth refresh for the root and public viewer paths", () => {
    expect(shouldBypassAuthRefresh("/")).toBe(true);
    expect(shouldBypassAuthRefresh("/demo-school/calendar")).toBe(true);
  });

  it("keeps staff routes behind middleware authentication", () => {
    expect(shouldBypassAuthRefresh("/dashboard")).toBe(false);
  });
});
