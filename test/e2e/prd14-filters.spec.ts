import { test, expect } from "@playwright/test";

/**
 * PRD §14 — Output views: "Filter state persists across views and is
 * preserved in the URL."
 *
 * Asserts that flipping a grade pill on /agenda writes `?grades=…` to the
 * URL, and that navigating to the Gantt with the same URL preserves the
 * filter. No DB needed beyond a school slug — uses the demo seed.
 */
test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL not set — skipping DB-dependent filter e2e",
);

test("FILTERS-PRD14: grade filter round-trips through the URL across views", async ({ page }) => {
  await page.goto("/demo-school/agenda");
  // Toggle grade 10.
  await page.getByRole("button", { name: "10", exact: true }).first().click();
  await expect(page).toHaveURL(/grades=10/);

  // Navigate to the Gantt with the same URL — filter must survive.
  const url = page.url().replace("/agenda", "");
  await page.goto(url);
  const tenPill = page.getByRole("button", { name: "10", exact: true }).first();
  await expect(tenPill).toHaveAttribute("aria-pressed", "true");
});
