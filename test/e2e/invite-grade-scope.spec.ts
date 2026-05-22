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

// ─── Admin invite API ────────────────────────────────────────────────────────

test.describe("INVITE: admin creates invite links via API", () => {
  test.use({ storageState: "test/e2e/.auth/admin.json" });
  test.skip(skip, "ADMIN_E2E=1 and DATABASE_URL required");

  test("INVITE-01: editor invite returns 201 with token and url", async ({ request }) => {
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

  test("setup: create draft event", async ({ request }) => {
    const res = await request.post("/api/v1/events");
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

  test("SCOPE-02: PATCH with grade 11 returns 403 scope_violation", async ({ request }) => {
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

// ─── Event editor UI ─────────────────────────────────────────────────────────

test.describe("EVENT EDITOR: grade scope is enforced for grade-10 editor", () => {
  test.use({ storageState: "test/e2e/.auth/editor.json" });
  test.skip(skip, "ADMIN_E2E=1 and DATABASE_URL required");

  test("EDITOR-01: only grade 10 button is rendered", async ({ page }) => {
    await page.goto("/events/new");

    await expect(page.locator('[data-grade="10"]')).toBeVisible();
    await expect(page.locator('[data-grade="7"]')).not.toBeVisible();
    await expect(page.locator('[data-grade="11"]')).not.toBeVisible();
  });

  test("EDITOR-02: publishing an event redirects to /dashboard", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto("/events/new");

    await page.getByLabel("שם האירוע").fill("E2E Grade-10 Event");
    await page.getByLabel("אחראי").fill("E2E Tester");
    await page.locator('input[type="date"]').fill("2026-06-16");
    await page.locator('[data-grade="10"]').click();
    await page.getByRole("main").getByRole("radio").first().click();

    const submitBtn = page.getByRole("main").getByRole("button", { name: "פרסם אירוע" });
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
    // Create and publish an approved event via admin so the viewer has something to see.
    const adminCtx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      storageState: "test/e2e/.auth/admin.json",
    });
    try {
      const createRes = await adminCtx.post("/api/v1/events");
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

  test("VIEWER-01: visiting /events/new redirects to public school page", async ({ page }) => {
    await page.goto("/events/new");
    // Staff layout redirects viewer to /{schoolSlug}
    await expect(page).not.toHaveURL(/\/events\/new/, { timeout: 5_000 });
    await expect(page.url()).toMatch(/demo-school|auth/);
  });

  test("VIEWER-02: approved event appears on the public Gantt page", async ({ page }) => {
    await page.goto("/demo-school");
    await expect(page.getByText(approvedEventTitle)).toBeVisible({ timeout: 10_000 });
  });
});
