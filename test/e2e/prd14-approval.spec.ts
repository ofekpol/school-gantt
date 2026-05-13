import { test, expect } from "@playwright/test";

/**
 * PRD §14 — Approval: "An administrator can approve or reject from the
 * queue in one click. Approved events appear in all output views within
 * five seconds."
 *
 * The 5 s freshness contract is implemented as Next.js ISR revalidate=5
 * on each public view (Phase 4 + 5 + 6). This spec asserts that a freshly
 * approved event becomes visible to an anonymous browser at /[school]
 * within that window.
 */
test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL not set — skipping DB-dependent approval e2e",
);

test("APPROVAL-PRD14: admin approves a pending event, public view shows it within 5 s", async ({
  browser,
}) => {
  const adminContext = await browser.newContext({
    storageState: "test/e2e/.auth/admin.json",
  });
  const publicContext = await browser.newContext({ storageState: undefined });

  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin/queue");

  const firstApprove = adminPage.getByRole("button", { name: /Approve|אשר/ }).first();
  await firstApprove.waitFor({ state: "visible" });

  // Grab the event's title before approving so we can search for it later.
  const card = adminPage.locator("li").filter({ has: firstApprove });
  const title = (await card.locator("p.font-medium").textContent())?.trim();
  expect(title).toBeTruthy();

  const t0 = Date.now();
  await firstApprove.click();

  const publicPage = await publicContext.newPage();
  // Poll up to 5 s — first hit may serve the previous cache, then ISR
  // revalidates within the budget.
  await expect(async () => {
    await publicPage.goto("/demo-school/agenda?cb=" + Date.now());
    await expect(publicPage.getByText(title!)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 5_000 });

  const elapsedMs = Date.now() - t0;
  expect(elapsedMs).toBeLessThan(5_000);

  await adminContext.close();
  await publicContext.close();
});
