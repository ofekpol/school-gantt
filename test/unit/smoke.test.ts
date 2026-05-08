import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("arithmetic still works", () => {
    expect(1 + 1).toBe(2);
  });

  it("cn() merges classes", async () => {
    const { cn } = await import("@/lib/utils");
    expect(cn("a", "b")).toBe("a b");
    expect(cn("p-2", "p-4")).toBe("p-4"); // tailwind-merge dedupes
  });
});
