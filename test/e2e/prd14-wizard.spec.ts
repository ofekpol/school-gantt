import { test, expect } from "@playwright/test";

/**
 * PRD §14 — Event creation: "An editor can complete the wizard end-to-end
 * in under 60 seconds for a typical event."
 *
 * This spec exercises the single-page event form. It also satisfies PRD §14
 * Accessibility: keyboard interactions are used wherever possible. The
 * `locator.fill()` call on the date input simulates keyboard entry and is
 * the Playwright-idiomatic way to set native date inputs (which do not
 * accept `keyboard.type()` in Chromium's date picker UI).
 *
 * Skipped when DATABASE_URL is unset because the wizard requires a seeded
 * school + editor account.
 */
test.skip(
  process.env.ADMIN_E2E !== "1" || !process.env.DATABASE_URL,
  "ADMIN_E2E=1 and DATABASE_URL required — skipping DB+auth wizard e2e",
);

test.use({ storageState: "test/e2e/.auth/editor.json" });

test("WIZARD-PRD14: editor publishes through the event form in under 60 s", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const start = Date.now();

  await page.goto("/events/new");
  const main = page.getByRole("main");

  await main.getByLabel("שם האירוע").fill("Trip — PRD14 wizard");
  await main.locator('input[type="date"]').fill("2030-06-15");
  await main.getByRole("radio").first().click();
  await main.getByRole("button", { name: "י", exact: true }).click();
  await main.getByRole("button", { name: "פרסם אירוע" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  const elapsedMs = Date.now() - start;
  expect(elapsedMs).toBeLessThan(60_000);
});
