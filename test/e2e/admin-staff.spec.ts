import { test, expect } from "@playwright/test";

/**
 * Admin staff management (E2E).
 *
 * Uses the admin auth state created by global.setup.ts (test/e2e/.auth/admin.json)
 * instead of a UI login — the app authenticates via Google OAuth, so there is no
 * password form to drive. Requires ADMIN_E2E=1 and DATABASE_URL.
 *
 * Current model: admins onboard staff by issuing invite links (InviteForm) —
 * there is no direct "create user with temporary password" form.
 */
const enabled = process.env.ADMIN_E2E === "1";
const dbReady = !!process.env.DATABASE_URL;
const skip = !enabled || !dbReady;

test.describe.configure({ mode: "serial" });
test.use({ storageState: "test/e2e/.auth/admin.json" });
test.skip(skip, "ADMIN_E2E=1 and DATABASE_URL required");

test("ADMIN-01 e2e: admin creates an editor invite via the staff page", async ({
  page,
}) => {
  await page.goto("/admin/staff");

  // Scope to the InviteForm (the only form with an email input).
  const form = page.locator('form:has(input[name="email"])');
  await expect(form).toBeVisible();

  await form.locator('select[name="role"]').selectOption("editor");
  await form.locator('input[name="email"]').fill(`e2e-${Date.now()}@demo-school.test`);
  await form.locator('input[name="invite-grade-10"]').check();
  await form.locator('button[type="submit"]').click();

  // On success the form renders the generated invite URL (contains /invite/).
  await expect(page.getByText(/\/invite\//)).toBeVisible({ timeout: 10_000 });
});
