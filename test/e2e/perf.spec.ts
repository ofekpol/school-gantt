import { test, expect, request } from "@playwright/test";

/**
 * Phase 8 perf assertions, mapped to PRD §11:
 *   - Gantt ≤ 2 s first paint with 1 k events
 *   - iCal feed ≤ 500 ms response
 *
 * Requires the demo seed + `pnpm seed:perf` to have populated 1 000
 * approved events. Skipped otherwise.
 */
test.skip(
  !process.env.DATABASE_URL || !process.env.PERF_ENABLED,
  "PERF_ENABLED + DATABASE_URL required",
);

test("PERF: Gantt at /demo-school paints under 2 s with 1k events", async ({ page }) => {
  const t0 = Date.now();
  await page.goto("/demo-school", { waitUntil: "domcontentloaded" });
  // Wait for at least one event bar to appear — that's the first paint
  // of the Gantt rather than the chrome.
  await page.getByRole("button").filter({ hasText: /Perf event #1\b/ }).first().waitFor({
    state: "visible",
    timeout: 4_000,
  });
  const elapsed = Date.now() - t0;
  console.log(`Gantt first-bar paint: ${elapsed} ms`);
  expect(elapsed).toBeLessThan(2_000);
});

test("PERF: iCal feed responds under 500 ms", async () => {
  if (!process.env.PERF_TOKEN) {
    test.skip(true, "PERF_TOKEN unset — set to a valid iCal token");
  }
  const api = await request.newContext({ baseURL: "http://localhost:3000" });
  const t0 = Date.now();
  const res = await api.get(`/ical/${process.env.PERF_TOKEN}`);
  const elapsed = Date.now() - t0;
  console.log(`iCal feed response: ${elapsed} ms`);
  expect(res.status()).toBe(200);
  expect(elapsed).toBeLessThan(500);
  await api.dispose();
});
