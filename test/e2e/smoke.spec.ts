import { test, expect } from "@playwright/test";

test("home page renders Hebrew RTL placeholder", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.getByRole("heading", { name: "שלום עולם" })).toBeVisible();
});
