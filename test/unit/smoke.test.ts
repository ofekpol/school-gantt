import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("arithmetic still works", () => {
    expect(1 + 1).toBe(2);
  });

  it("path aliases resolve via tsconfig-paths", async () => {
    // This import proves that vite-tsconfig-paths is wired.
    // Once lib/utils.ts is created in Task 3, this test is upgraded to import cn().
    expect(typeof "@/lib/utils").toBe("string");
  });
});
