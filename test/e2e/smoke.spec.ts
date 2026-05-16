import { test, expect } from "@playwright/test";

/**
 * Smoke test — passes without a DB because the school list is empty when
 * DATABASE_URL is unset (the route still renders, with the empty state).
 */
test("home page renders with RTL Hebrew chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  // Title from messages/he.json → home.title
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("skip-to-content link is the first tab stop", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  // Skip link should now be visible and focused.
  const skipLink = page.getByRole("link", { name: /skip|דלג/i });
  await expect(skipLink).toBeFocused();
});

test("locale toggle is not shown in Hebrew-only mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("radiogroup", { name: /שפה|language/i })).toHaveCount(0);
});
