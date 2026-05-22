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
  process.env.ADMIN_E2E !== "1" || !process.env.DATABASE_URL,
  "ADMIN_E2E=1 and DATABASE_URL required — skipping DB+auth filter e2e",
);

test("FILTERS-PRD14: grade filter round-trips through the URL across views", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/demo-school/agenda");
  // Grades render "all on" by default; clicking a pill toggles it OFF and
  // writes the remaining set to the URL as repeated `grades=` params.
  // Wait for FilterBar to hydrate. Under load the grade pills are present in
  // the server HTML but React onClick is only wired up after hydration completes.
  // Poll until clicking the grade-10 ("י") pill actually deselects it.
  await expect(async () => {
    // Navigate back to clean URL on each retry.
    if (page.url().includes("grades=")) {
      await page.goto("/demo-school/agenda");
    }
    const tenBtn = page.getByRole("button", { name: "י", exact: true }).first();
    await tenBtn.waitFor({ state: "visible" });
    await tenBtn.click();
    // Grade 10 is now off; the URL carries the remaining grades and not grade 10.
    await expect(page).toHaveURL(/grades=/, { timeout: 5_000 });
    await expect(tenBtn).toHaveAttribute("aria-pressed", "false");
  }).toPass({ timeout: 20_000 });
  expect(page.url()).not.toMatch(/grades=10(&|$)/);

  // Navigate to the Gantt with the same URL — the deselected grade must survive.
  const url = page.url().replace("/agenda", "");
  await page.goto(url);
  const tenPill = page.getByRole("button", { name: "י", exact: true }).first();
  await expect(tenPill).toHaveAttribute("aria-pressed", "false");
});
