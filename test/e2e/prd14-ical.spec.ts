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
  process.env.ADMIN_E2E !== "1" || !process.env.DATABASE_URL,
  "ADMIN_E2E=1 and DATABASE_URL required — skipping DB+auth iCal e2e",
);

test.use({ storageState: "test/e2e/.auth/editor.json" });

test("ICAL-PRD14: staff creates token, fetches feed, revokes, feed 404s", async ({ page, playwright }) => {
  const created = await page.request.post("/api/v1/ical-subscriptions", { data: {} });
  expect(created.status()).toBe(201);
  const { id, token } = (await created.json()) as { id: string; token: string };

  // Fetch the feed anonymously — should be 200 with text/calendar.
  const anonymous = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } });
  const ok = await anonymous.get(`/ical/${token}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("text/calendar");

  const revoked = await page.request.delete(`/api/v1/ical-subscriptions/${id}`);
  expect(revoked.ok()).toBeTruthy();

  // The cache header is max-age=60, so bust any cached copy.
  const gone = await anonymous.get(`/ical/${token}?cb=${Date.now()}`);
  expect(gone.status()).toBe(404);

  await anonymous.dispose();
});
