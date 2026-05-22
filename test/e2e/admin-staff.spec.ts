import { test, expect } from "@playwright/test";

/**
 * Admin staff + academic-year management (E2E).
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

test("ADMIN-03 e2e: admin creates and activates an academic year", async ({
  page,
}) => {
  await page.goto("/admin/year");
  const yearLabel = `E2E ${Date.now()}`;
  await page.locator('input[name="label"]').fill(yearLabel);
  await page.locator('input[name="startDate"]').fill("2099-09-01");
  await page.locator('input[name="endDate"]').fill("2100-07-31");
  await page.locator('input[name="setActive"]').check();
  await page.getByRole("button", { name: /create|צור שנה/i }).click();

  await expect(page.getByText(yearLabel)).toBeVisible({ timeout: 10_000 });
  // Active badge text from messages: "פעילה" (he) / "Active" (en)
  const row = page.locator(`tr:has-text("${yearLabel}")`);
  await expect(row).toContainText(/active|פעילה/i);
});

// Activating the 2099 year above mutates shared school state. Restore the
// current-year as active so other date-bounded specs (wizard, approval, viewer,
// which use in-year 2026 dates) are not poisoned by the future active year.
test.afterAll(async ({ playwright }) => {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const currentLabel = `${startYear}-${startYear + 1}`;
  const ctx = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    storageState: "test/e2e/.auth/admin.json",
  });
  try {
    const res = await ctx.get("/api/v1/admin/years");
    const { years } = (await res.json()) as { years: { id: string; label: string }[] };
    const current = years.find((y) => y.label === currentLabel);
    if (current) {
      await ctx.patch(`/api/v1/admin/years/${current.id}`, {
        data: { setActive: true },
        headers: { "Content-Type": "application/json" },
      });
    }
  } finally {
    await ctx.dispose();
  }
});
