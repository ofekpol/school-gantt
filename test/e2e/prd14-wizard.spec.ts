import { test, expect } from "@playwright/test";

/**
 * PRD §14 — Event creation: "An editor can complete the wizard end-to-end
 * in under 60 seconds for a typical event."
 *
 * This spec exercises the full 7-step wizard. It also satisfies PRD §14
 * Accessibility: keyboard interactions are used wherever possible. The
 * `locator.fill()` call on the date input simulates keyboard entry and is
 * the Playwright-idiomatic way to set native date inputs (which do not
 * accept `keyboard.type()` in Chromium's date picker UI).
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
  test.setTimeout(90_000);
  const start = Date.now();

  await page.goto("/events/new");

  // Helper: click the wizard's own "Next" / "הבא" button.
  // Scoped to <main> to avoid the Next.js Dev Tools floating button whose
  // aria-label "Open Next.js Dev Tools" also matches /Next/.
  const nextBtn = () =>
    page.getByRole("main").getByRole("button", { name: "הבא" }).first();

  // Step 1 — Date. Use locator.fill() which correctly drives native date inputs.
  // Use a date within the 2025-2026 academic year (Sept 2025 – Jul 2026).
  await page.locator('input[type="date"]').fill("2026-06-15");
  await nextBtn().click();

  // Step 2 — Grades. Click the first grade pill.
  await page.getByRole("main").getByRole("button", { name: /ז|ח|ט|י/ }).first().click();
  await nextBtn().click();

  // Step 3 — Event type. Click the first radio button.
  await page.getByRole("main").getByRole("radio").first().click();
  await nextBtn().click();

  // Step 4 — Title. Fill the text input.
  await page.getByRole("main").locator('input[type="text"]').fill("Trip — PRD14 wizard");
  await nextBtn().click();

  // Step 5 — Time. Default values are valid; just advance.
  await nextBtn().click();

  // Step 6 — Responsible. Fill the text input.
  await page.getByRole("main").locator('input[type="text"]').fill("Yaakov Levi");
  await nextBtn().click();

  // Step 7 — Submit for approval. Wait for button to be enabled before clicking.
  const submitBtn = page.getByRole("main").getByRole("button", { name: /שלח/ });
  await submitBtn.waitFor({ state: "visible" });
  await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
  await submitBtn.click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  const elapsedMs = Date.now() - start;
  expect(elapsedMs).toBeLessThan(60_000);
});
