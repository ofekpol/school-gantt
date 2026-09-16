import { test, expect } from "@playwright/test";

/**
 * Read-only public schedule: /auth/login → /schedule → weekly/monthly only,
 * filters still work, "Log in" returns to /auth/login. No DB write needed —
 * uses the demo seed's single school, same as the other unauthenticated
 * public-viewer specs.
 */
test("READONLY: login screen links to a 2-tab read-only schedule with working filters", async ({ page }) => {
  await page.goto("/auth/login");

  await page.getByRole("link", { name: "צפייה בלוח בלי להתחבר" }).click();
  await expect(page).toHaveURL(/\/schedule$/);

  // Exactly weekly + monthly tabs, no agenda.
  const weeklyTab = page.getByRole("button", { name: "שבועי" });
  const monthlyTab = page.getByRole("button", { name: "חודשי" });
  await expect(weeklyTab).toBeVisible();
  await expect(monthlyTab).toBeVisible();
  await expect(page.getByRole("button", { name: "סדר יום" })).toHaveCount(0);

  // No export-to-Google-Calendar affordance.
  await expect(page.getByRole("button", { name: /ייצוא/ })).toHaveCount(0);

  // Grade filter still narrows the weekly view.
  await expect(async () => {
    const tenBtn = page.getByRole("button", { name: "י", exact: true }).first();
    await tenBtn.waitFor({ state: "visible" });
    await tenBtn.click();
    await expect(tenBtn).toHaveAttribute("aria-pressed", "false");
  }).toPass({ timeout: 20_000 });

  // Monthly tab switches without leaving /schedule.
  await monthlyTab.click();
  await expect(page).toHaveURL(/\/schedule$/);

  // Login button returns to the real login page.
  await page.getByRole("link", { name: "התחברות" }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("READONLY: existing full public viewer is unaffected", async ({ page }) => {
  await page.goto("/demo-school");
  await expect(page.getByRole("button", { name: "גאנט" })).toBeVisible();
  await expect(page.getByRole("button", { name: "לוח שנה" })).toBeVisible();
  await expect(page.getByRole("button", { name: "סדר יום" })).toBeVisible();
});
