import { test, expect } from "@playwright/test";
import { DEMO_SCHOOL_ACCESS_TOKEN, DEMO_SCHOOL_PATH } from "../../db/demo-school";

/**
 * Read-only public schedule: the demo school's link (/auth/login?school=<token>)
 * → guest button → /schedule?school=<token> → weekly/monthly only, filters
 * still work, "Log in" returns to /auth/login. No DB write needed — uses the
 * demo seed's fixed link token.
 */
test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL required — skipping DB-dependent e2e",
);

test("READONLY: login screen links to a 2-tab read-only schedule with working filters", async ({ page }) => {
  await page.goto(`/auth/login?school=${DEMO_SCHOOL_ACCESS_TOKEN}`);

  const guest = page.getByRole("link", { name: "המשך כאורח (צפייה בלוח)" });
  await expect(guest).toHaveAttribute("href", `/schedule?school=${DEMO_SCHOOL_ACCESS_TOKEN}`);
  await guest.click();

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

  // Monthly tab switches without leaving /schedule. Wait for hydration and
  // assert the calendar view actually rendered (not just a no-op click).
  await expect(async () => {
    await monthlyTab.waitFor({ state: "visible" });
    await monthlyTab.click();
    await expect(page).toHaveURL(new RegExp(`/schedule[?]school=${DEMO_SCHOOL_ACCESS_TOKEN}$`), { timeout: 5_000 });
    // YearCalendarGrid renders navigation buttons with these Hebrew labels.
    await expect(page.getByRole("button", { name: "חודש קודם" })).toBeVisible();
  }).toPass({ timeout: 20_000 });

  // Login button returns to the real login page.
  await page.getByRole("link", { name: "התחברות" }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("READONLY: existing full public viewer is unaffected", async ({ page }) => {
  await page.goto(DEMO_SCHOOL_PATH);
  await expect(page.getByRole("button", { name: "גאנט" })).toBeVisible();
  await expect(page.getByRole("button", { name: "לוח שנה" })).toBeVisible();
  await expect(page.getByRole("button", { name: "סדר יום" })).toBeVisible();
});
