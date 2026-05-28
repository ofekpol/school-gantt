import { test, expect } from "@playwright/test";

/**
 * Invite → grade-scope → publish → viewer tests (E2E).
 *
 * Requires: ADMIN_E2E=1, DATABASE_URL set, dev server running.
 * Auth state files created by global.setup.ts:
 *   admin  → test/e2e/.auth/admin.json
 *   editor → test/e2e/.auth/editor.json  (grade10@demo-school.test, grade 10 scope)
 *   viewer → test/e2e/.auth/viewer.json  (viewer@demo-school.test, role=viewer)
 *
 * Test cases:
 *   INVITE-01/02: admin creates invite links via POST /api/v1/admin/staff/invites
 *   SCOPE-01/02:  grade-10 editor PATCH accepted for grade 10, rejected for grade 11
 *   WIZARD-01:    wizard step 2 shows only grade 10 button for the scoped editor
 *   WIZARD-02:    completing the wizard redirects to /dashboard
 *   VIEWER-01:    viewer visiting /events/new is redirected to the public school page
 *   VIEWER-02:    viewer sees an approved event on the public Gantt
 */

const enabled = process.env.ADMIN_E2E === "1";
const dbReady = !!process.env.DATABASE_URL;
const skip = !enabled || !dbReady;

// POST /api/v1/events requires an eventTypeId. Event types are only listed via
// the admin API, so fetch the first one through a short-lived admin context.
async function firstEventTypeId(
  playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"],
): Promise<string> {
  const adminCtx = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    storageState: "test/e2e/.auth/admin.json",
  });
  try {
    const res = await adminCtx.get("/api/v1/admin/event-types");
    const body = (await res.json()) as { eventTypes: { id: string }[] };
    return body.eventTypes[0].id;
  } finally {
    await adminCtx.dispose();
  }
}

// ─── Admin invite API ────────────────────────────────────────────────────────

test.describe("INVITE: admin creates invite links via API", () => {
  test.use({ storageState: "test/e2e/.auth/admin.json" });
  test.skip(skip, "ADMIN_E2E=1 and DATABASE_URL required");

  test("INVITE-01: editor invite returns 201 with token and url", async ({
    request,
  }) => {
    const res = await request.post("/api/v1/admin/staff/invites", {
      data: { role: "editor", gradeScopes: [10], expiresInHours: 24 },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.url).toContain("/invite/");
    expect(body.url).toContain(body.token);
  });

  test("INVITE-02: viewer invite returns 201", async ({ request }) => {
    const res = await request.post("/api/v1/admin/staff/invites", {
      data: { role: "viewer", gradeScopes: [] },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });
});

// ─── Grade scope HTTP enforcement ────────────────────────────────────────────

test.describe("SCOPE: grade scope enforcement via HTTP (grade-10 editor)", () => {
  test.use({ storageState: "test/e2e/.auth/editor.json" });
  test.skip(skip, "ADMIN_E2E=1 and DATABASE_URL required");
  test.describe.configure({ mode: "serial" });

  let eventId: string;
  let version: number;

  test("setup: create draft event", async ({ request, playwright }) => {
    const eventTypeId = await firstEventTypeId(playwright);
    const res = await request.post("/api/v1/events", {
      data: { eventTypeId },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    eventId = body.id;
    version = body.version;
  });

  test("SCOPE-01: PATCH with grade 10 returns 200", async ({ request }) => {
    const res = await request.patch(`/api/v1/events/${eventId}`, {
      data: {
        title: "E2E Scope Test Event",
        grades: [10],
        startAt: "2026-06-15T09:00:00.000Z",
        endAt: "2026-06-15T16:00:00.000Z",
      },
      headers: { "if-match": String(version) },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    version = body.version;
  });

  test("SCOPE-02: PATCH with grade 11 returns 403 scope_violation", async ({
    request,
  }) => {
    const res = await request.patch(`/api/v1/events/${eventId}`, {
      data: { grades: [11] },
      headers: { "if-match": String(version) },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("scope_violation");
    expect(body.grades).toContain(11);
  });
});

// ─── Wizard UI ───────────────────────────────────────────────────────────────

test.describe("WIZARD: wizard step 2 shows only allowed grades (grade-10 editor)", () => {
  test.use({ storageState: "test/e2e/.auth/editor.json" });
  test.skip(skip, "ADMIN_E2E=1 and DATABASE_URL required");

  test("WIZARD-01: only grade 10 button is rendered in step 2", async ({ page }) => {
    await page.goto("/events/new");

    // Advance past step 1 (date)
    await page.locator('input[type="date"]').fill("2026-06-15");
    const nextBtn = () =>
      page.getByRole("main").getByRole("button", { name: "הבא" }).first();
    await nextBtn().click();

    // Step 2 — grades
    await expect(page.locator('[data-grade="10"]')).toBeVisible();
    // No other grade buttons should be present (grade-10 scope only)
    await expect(page.locator('[data-grade="7"]')).not.toBeVisible();
    await expect(page.locator('[data-grade="11"]')).not.toBeVisible();
  });

  test("WIZARD-02: completing the wizard redirects to /dashboard", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto("/events/new");

    const nextBtn = () =>
      page.getByRole("main").getByRole("button", { name: "הבא" }).first();

    // Step 1 — date
    await page.locator('input[type="date"]').fill("2026-06-16");
    await nextBtn().click();

    // Step 2 — grade (only grade 10 available)
    await page.locator('[data-grade="10"]').click();
    await nextBtn().click();

    // Step 3 — event type
    await page.getByRole("main").getByRole("radio").first().click();
    await nextBtn().click();

    // Step 4 — title
    await page
      .getByRole("main")
      .locator('input[type="text"]')
      .fill("E2E Wizard Grade-10 Event");
    await nextBtn().click();

    // Step 5 — time (defaults valid)
    await nextBtn().click();

    // Step 6 — responsible
    await page.getByRole("main").locator('input[type="text"]').fill("E2E Tester");
    await nextBtn().click();

    // Step 7 — publish (draft → approved)
    const submitBtn = page.getByRole("main").getByRole("button", { name: /פרסם/ });
    await submitBtn.waitFor({ state: "visible" });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });
});

// ─── Viewer experience ────────────────────────────────────────────────────────

test.describe("VIEWER: viewer staff account experience", () => {
  test.use({ storageState: "test/e2e/.auth/viewer.json" });
  test.skip(skip, "ADMIN_E2E=1 and DATABASE_URL required");

  let approvedEventTitle: string;

  test.beforeAll(async ({ playwright }) => {
    // Cold-compiling the admin/event API routes under full-suite load can exceed
    // the default 30 s hook timeout.
    test.setTimeout(60_000);
    // Create and publish an approved event via admin so the viewer has something to see.
    const eventTypeId = await firstEventTypeId(playwright);
    const adminCtx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      storageState: "test/e2e/.auth/admin.json",
    });
    try {
      const createRes = await adminCtx.post("/api/v1/events", {
        data: { eventTypeId },
        headers: { "Content-Type": "application/json" },
      });
      const { id, version } = await createRes.json();
      approvedEventTitle = `E2E Viewer Test Event ${Date.now()}`;

      await adminCtx.patch(`/api/v1/events/${id}`, {
        data: {
          title: approvedEventTitle,
          grades: [10],
          startAt: "2026-06-18T09:00:00.000Z",
          endAt: "2026-06-18T16:00:00.000Z",
        },
        headers: { "if-match": String(version) },
      });

      await adminCtx.post(`/api/v1/events/${id}/submit`);
    } finally {
      await adminCtx.dispose();
    }
  });

  test("VIEWER-01: visiting /events/new redirects to the read-only dashboard", async ({
    page,
  }) => {
    await page.goto("/events/new");
    // Viewers can use the dashboard, but cannot enter the event wizard.
    await expect(page).not.toHaveURL(/\/events\/new/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("VIEWER-02: approved event appears on a public view (agenda)", async ({
    page,
  }) => {
    // The agenda lists event titles as plain text — a reliable public-view
    // assertion. (The Gantt renders titles inside a wide, horizontally-scrolled
    // canvas where individual labels are not reliably in-viewport.)
    await page.goto("/demo-school/agenda");
    await expect(page.getByText(approvedEventTitle).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
