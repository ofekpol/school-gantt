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

test("PERF: public filter click responds under 250 ms", async ({ page }) => {
  await page.goto("/demo-school/agenda", { waitUntil: "domcontentloaded" });
  const elapsed = await page.evaluate(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (item) => item.textContent?.trim() === "י" && item.getAttribute("aria-pressed") !== null,
    );
    if (!button) throw new Error("grade filter missing");
    if (button.getAttribute("aria-pressed") === "false") {
      (button as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const t0 = performance.now();
    (button as HTMLButtonElement).click();
    while (performance.now() - t0 < 1_000 && button.getAttribute("aria-pressed") !== "false") {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return performance.now() - t0;
  });
  expect(elapsed).toBeLessThan(250);
});

test("PERF: public tab switch displays from local data under 500 ms", async ({ page }) => {
  await page.goto("/demo-school/agenda", { waitUntil: "domcontentloaded" });
  const elapsed = await page.evaluate(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (item) => item.textContent?.trim() === "גאנט" && item.getAttribute("aria-pressed") !== null,
    );
    if (!button) throw new Error("gantt tab missing");
    const t0 = performance.now();
    (button as HTMLButtonElement).click();
    while (performance.now() - t0 < 1_000 && button.getAttribute("aria-pressed") !== "true") {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return performance.now() - t0;
  });
  await expect(page).toHaveURL(/\/demo-school(\?|$)/);
  await expect(page.getByRole("button", { name: "גאנט" })).toHaveAttribute("aria-pressed", "true");
  expect(elapsed).toBeLessThan(500);
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
