import { test, expect, request } from "@playwright/test";

/**
 * PRD §14 — iCalendar: "Tokens can be revoked and revoked tokens return
 * HTTP 404 within one minute."
 *
 * The Phase 7 route sets `Cache-Control: max-age=60`, so once the cached
 * 200 response expires the next fetch hits the route handler, which sees
 * `revoked_at` and returns 404. This test asserts the immediate path
 * (before the cache TTL elapses, since Playwright doesn't share an edge
 * cache with prod).
 */
test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL not set — skipping DB-dependent iCal e2e",
);

test.use({ storageState: "test/e2e/.auth/editor.json" });

test("ICAL-PRD14: staff creates token, fetches feed, revokes, feed 404s", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/profile");

  await page.getByRole("button", { name: /New subscription|מנוי חדש/ }).click();
  await page.getByRole("button", { name: /Create|צור מנוי/ }).click();

  const tokenUrlInput = page.locator("input[readonly]").first();
  const tokenUrl = await tokenUrlInput.inputValue();
  expect(tokenUrl).toContain("/ical/");

  // Fetch the feed anonymously — should be 200 with text/calendar.
  const api = await request.newContext();
  const ok = await api.get(tokenUrl);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("text/calendar");

  // Extract the token from the URL so we can find the specific row later.
  const token = tokenUrl.split("/ical/")[1]?.split("?")[0] ?? "";
  expect(token).toBeTruthy();

  // Dismiss the fresh-token panel.
  await page.getByRole("button", { name: /Done|סיום/ }).click();

  // Find the specific subscription row by its token URL input value, then
  // click the Revoke button within that row. This is robust even when other
  // subscriptions exist from previous test runs.
  const subscriptionRow = page.locator("li").filter({
    has: page.locator(`input[value*="${token}"]`),
  });
  await subscriptionRow.waitFor({ state: "visible" });
  const revokeBtn = subscriptionRow.getByRole("button", { name: /Revoke|בטל מנוי/ });
  await revokeBtn.waitFor({ state: "visible" });
  await revokeBtn.click();

  // Wait for the subscription row to be removed from the DOM. The optimistic
  // update in ProfileSubscriptions hides the row immediately on DELETE success.
  await expect(subscriptionRow).not.toBeVisible({ timeout: 15_000 });

  // Re-fetch — must 404. The cache header is max-age=60 so a fresh request
  // with a cache-busting param skips any local cache.
  const gone = await api.get(`${tokenUrl}?cb=${Date.now()}`);
  expect(gone.status()).toBe(404);

  await api.dispose();
});
