import { test, expect } from "@playwright/test";

const SKIP = !process.env.TEST_SUPABASE_EMAIL_SIGNUP;

test.describe("Email/Password Registration Flow", () => {
  test.skip(SKIP, "Requires TEST_SUPABASE_EMAIL_SIGNUP env var");

  test("register page is accessible from login page", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: "כניסה למערכת" })).toBeVisible();
    await page.getByRole("link", { name: "הרשמה" }).click();
    await expect(page.getByRole("heading", { name: "הרשמה למערכת" })).toBeVisible();
  });

  test("register form shows check-email state after valid submission", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("שם מלא").fill("Test User");
    await page.getByLabel("אימייל").fill(`test-${Date.now()}@example.com`);
    await page.getByLabel("סיסמה", { exact: true }).fill("password123");
    await page.getByLabel("אישור סיסמה").fill("password123");
    await page.getByRole("button", { name: "הרשמה" }).click();
    await expect(page.getByText("בדקו את תיבת הדואר שלכם")).toBeVisible();
  });

  test("register form shows error for duplicate email", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("שם מלא").fill("Test User");
    await page.getByLabel("אימייל").fill("admin@school.test"); // seed user
    await page.getByLabel("סיסמה", { exact: true }).fill("password123");
    await page.getByLabel("אישור סיסמה").fill("password123");
    await page.getByRole("button", { name: "הרשמה" }).click();
    await expect(page.getByRole("alert")).toContainText("כבר רשומה");
  });

  test("login page shows confirmed banner after ?confirmed=1", async ({ page }) => {
    await page.goto("/auth/login?confirmed=1");
    await expect(page.getByText("האימייל אושר בהצלחה")).toBeVisible();
  });

  test("login page shows invalid token banner after ?error=invalid_token", async ({ page }) => {
    await page.goto("/auth/login?error=invalid_token");
    await expect(page.getByText("קישור האישור אינו תקף")).toBeVisible();
  });
});
