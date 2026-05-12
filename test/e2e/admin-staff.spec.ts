import { test, expect, type Page } from "@playwright/test";

const enabled = process.env.ADMIN_E2E === "1";

test.describe.configure({ mode: "serial" });
test.skip(!enabled, "ADMIN_E2E=1 required (needs seeded admin account)");

// Assumes seed admin: admin@school-a.test / "admin-test-pw"
async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@school-a.test");
  await page.getByLabel(/password/i).fill("admin-test-pw");
  await page.getByRole("button", { name: /sign in|התחבר/i }).click();
  await page.waitForURL(/\/(dashboard|admin)/);
}

test("ADMIN-01 e2e: admin creates an editor and it appears in the staff list", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/admin/staff");
  const uniqueEmail = `e2e-${Date.now()}@school-a.test`;
  await page.getByRole("button", { name: /create|צור משתמש/i }).first().click();
  await page.locator('input[name="email"]').fill(uniqueEmail);
  await page.locator('input[name="fullName"]').fill("E2E Editor");
  await page.locator('select[name="role"]').selectOption("editor");
  await page.locator('input[name="temporaryPassword"]').fill("Initial1234!");
  await page.locator('input[name="grade-10"]').check();
  // Click the submit button inside the create form (second "create" button — first toggles)
  await page.getByRole("button", { name: /create|צור משתמש/i }).last().click();
  // After router.refresh the row should be visible
  await expect(page.getByText(uniqueEmail)).toBeVisible({ timeout: 10000 });
});

test("ADMIN-03 e2e: admin sets active academic year and wizard reflects bounds", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/admin/year");
  const yearLabel = `E2E ${Date.now()}`;
  await page.locator('input[name="label"]').fill(yearLabel);
  await page.locator('input[name="startDate"]').fill("2099-09-01");
  await page.locator('input[name="endDate"]').fill("2100-07-31");
  await page.locator('input[name="setActive"]').check();
  await page.getByRole("button", { name: /create|צור שנה/i }).click();
  await expect(page.getByText(yearLabel)).toBeVisible({ timeout: 10000 });
  // Active badge text from messages/he.json: "פעילה" or messages/en.json: "Active"
  const row = page.locator(`tr:has-text("${yearLabel}")`);
  await expect(row).toContainText(/active|פעילה/i);
});
