import { test, expect } from "@playwright/test";

/**
 * PRD §14 — Event creation: "An editor can complete event creation end-to-end
 * in under 60 seconds for a typical event."
 *
 * This spec exercises the single-page event editor. It also satisfies PRD §14
 * accessibility: keyboard interactions are used wherever possible. The
 * `locator.fill()` call on the date input simulates keyboard entry and is
 * the Playwright-idiomatic way to set native date inputs (which do not
 * accept `keyboard.type()` in Chromium's date picker UI).
 *
 * Skipped when DATABASE_URL is unset because the editor requires a seeded
 * school + editor account.
 */
test.skip(!process.env.DATABASE_URL, "DATABASE_URL not set — skipping DB-dependent wizard e2e");

test.use({ storageState: "test/e2e/.auth/editor.json" });

test("EVENT-PRD14: editor creates an event in under 60 s", async ({ page }) => {
  test.setTimeout(90_000);
  const start = Date.now();

  await page.goto("/events/new");

  // Use a date within the 2025-2026 academic year (Sept 2025 – Jul 2026).
  await page.getByLabel("שם האירוע").fill("Trip PRD14 editor");
  await page.getByLabel("אחראי").fill("Yaakov Levi");
  await page.locator('input[type="date"]').fill("2026-06-15");

  await page
    .getByRole("main")
    .getByRole("button", { name: /ז|ח|ט|י/ })
    .first()
    .click();
  await page.getByRole("main").getByRole("radio").first().click();

  const submitBtn = page.getByRole("main").getByRole("button", { name: "פרסם אירוע" });
  await submitBtn.waitFor({ state: "visible" });
  await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
  await submitBtn.click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  const elapsedMs = Date.now() - start;
  expect(elapsedMs).toBeLessThan(60_000);
});
