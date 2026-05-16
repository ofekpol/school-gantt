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
  test.setTimeout(60_000);
  await page.goto("/demo-school/agenda");
  // Wait for FilterBar to hydrate. Under load the grade pills are present in
  // the server HTML but React onClick is only wired up after hydration completes.
  // Poll until clicking the grade pill actually changes the URL.
  await expect(async () => {
    // Navigate back to clean URL on each retry.
    if (page.url().includes("grades=")) {
      await page.goto("/demo-school/agenda");
    }
    const tenBtn = page.getByRole("button", { name: "י", exact: true }).first();
    await tenBtn.waitFor({ state: "visible" });
    await tenBtn.click();
    await expect(page).toHaveURL(/grades=10/, { timeout: 5_000 });
  }).toPass({ timeout: 20_000 });

  // Navigate to the Gantt with the same URL — filter must survive.
  const url = page.url().replace("/agenda", "");
  await page.goto(url);
  const tenPill = page.getByRole("button", { name: "י", exact: true }).first();
  await expect(tenPill).toHaveAttribute("aria-pressed", "true");
});
