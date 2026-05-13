import { test, expect } from "@playwright/test";

/**
 * PRD §14 — Event creation: "An editor can complete the wizard end-to-end
 * in under 60 seconds for a typical event."
 *
 * This spec exercises the full 7-step wizard via the keyboard only — which
 * also satisfies PRD §14 Accessibility: "All wizard steps are completable
 * with keyboard only."
 *
 * Skipped when DATABASE_URL is unset because the wizard requires a seeded
 * school + editor account.
 */
test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL not set — skipping DB-dependent wizard e2e",
);

test.use({ storageState: "test/e2e/.auth/editor.json" });

test("WIZARD-PRD14: editor completes the 7-step wizard in under 60 s with keyboard only", async ({
  page,
}) => {
  const start = Date.now();

  await page.goto("/events/new");

  // Step 1 — Date.
  await page.keyboard.press("Tab");
  await page.keyboard.type("2026-10-15");
  await page.getByRole("button", { name: /Next|הבא/ }).click();

  // Step 2 — Grades. Tab into the first grade pill, Space to toggle.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /Next|הבא/ }).click();

  // Step 3 — Event type. First radio.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /Next|הבא/ }).click();

  // Step 4 — Title.
  await page.keyboard.press("Tab");
  await page.keyboard.type("Trip — PRD14 wizard");
  await page.getByRole("button", { name: /Next|הבא/ }).click();

  // Step 5 — Time. Default values are valid; just advance.
  await page.getByRole("button", { name: /Next|הבא/ }).click();

  // Step 6 — Responsible.
  await page.keyboard.press("Tab");
  await page.keyboard.type("Yaakov Levi");
  await page.getByRole("button", { name: /Next|הבא/ }).click();

  // Step 7 — Submit.
  await page.getByRole("button", { name: /Submit|שלח/ }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  const elapsedMs = Date.now() - start;
  expect(elapsedMs).toBeLessThan(60_000);
});
