import { test, expect } from "@playwright/test";
import { DEMO_SCHOOL_PATH } from "../../db/demo-school";

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
      data: { role: "editor", gradeScopes: [10] },
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

  test("WIZARD-01: only the grade 10 button is rendered", async ({ page }) => {
    await page.goto("/events/new");
    const main = page.getByRole("main");

    await expect(main.getByRole("button", { name: "י", exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "ז", exact: true })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "יא", exact: true })).toHaveCount(0);
  });

  test("WIZARD-02: publishing the form redirects to /dashboard", async ({ page }) => {
    await page.goto("/events/new");
    const main = page.getByRole("main");

    await main.getByLabel("שם האירוע").fill("E2E Wizard Grade-10 Event");
    await main.locator('input[type="date"]').fill("2030-06-16");
    await main.getByRole("radio").first().click();
    await main.getByRole("button", { name: "י", exact: true }).click();
    await main.getByRole("button", { name: "פרסם אירוע" }).click();

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
      storageState: "test/e2e/.auth/admin.json",
    });
    try {
      const createRes = await adminCtx.post("/api/v1/events", {
        data: { eventTypeId },
        headers: { "Content-Type": "application/json" },
      });
      const { id, version } = await createRes.json();
      approvedEventTitle = `E2E Viewer Test Event ${Date.now()}`;
      // The agenda opens on the current week, so a later date can be a page away.
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

      await adminCtx.patch(`/api/v1/events/${id}`, {
        data: {
          title: approvedEventTitle,
          grades: [10],
          startAt: `${today}T00:00:00.000Z`,
          endAt: `${today}T21:00:00.000Z`,
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
    await page.goto(`${DEMO_SCHOOL_PATH}/agenda`);
    await expect(page.getByText(approvedEventTitle).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
