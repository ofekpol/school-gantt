import { test, expect, request as pwRequest } from "@playwright/test";

/**
 * Latency audit — measures real wall-clock time for common user flows.
 *
 * Run against a locally running dev server:
 *   pnpm playwright test perf-latency
 *
 * For authenticated sections also set:
 *   ADMIN_E2E=1  DATABASE_URL=...  (triggers global.setup.ts auth state)
 *
 * All timings are printed with a [LATENCY] prefix — grep for it to extract
 * a clean report:
 *   pnpm playwright test perf-latency 2>&1 | grep LATENCY
 *
 * Thresholds are based on PRD §11 non-functional bars. A test failure means
 * an action exceeded its budget, not a functional regression.
 */

// ─── Thresholds (ms) ─────────────────────────────────────────────────────────

const T = {
  publicPage: 2_000,   // any public page → main content visible
  apiCall: 800,        // any single REST round-trip
  wizardStep: 1_500,   // wizard step transition (click Next → next step ready)
  wizardTotal: 30_000, // whole wizard end-to-end (excluding user think time)
  adminPage: 2_500,    // authenticated admin/staff/year page loads
  adminAction: 4_000,  // form submit → success response (invite creation etc.)
  publishApi: 3_000,   // POST /submit → 200
  publishVisible: 15_000, // POST /submit → event visible on public agenda
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wraps an async action, logs elapsed time, returns ms. */
async function timed(label: string, fn: () => Promise<void>): Promise<number> {
  const t0 = Date.now();
  await fn();
  const ms = Date.now() - t0;
  console.log(`[LATENCY] ${label}: ${ms} ms`);
  return ms;
}

function summary(title: string, rows: [string, number][]) {
  const width = Math.max(...rows.map(([l]) => l.length)) + 2;
  console.log(`\n[LATENCY] ── ${title} ──`);
  for (const [label, ms] of rows) {
    const status = ms > T.publicPage ? "⚠" : "✓";
    console.log(`[LATENCY]   ${status} ${label.padEnd(width)} ${ms} ms`);
  }
}

const authReady = process.env.ADMIN_E2E === "1" && !!process.env.DATABASE_URL;

// ─── 1. Public view page loads ───────────────────────────────────────────────

test.describe("Public views — page load latency", () => {
  for (const { label, path, readySelector } of [
    { label: "Home (/)", path: "/", readySelector: 'h1' },
    { label: "Gantt (/demo-school)", path: "/demo-school", readySelector: "main" },
    { label: "Calendar (/demo-school/calendar)", path: "/demo-school/calendar", readySelector: "main" },
    { label: "Agenda (/demo-school/agenda)", path: "/demo-school/agenda", readySelector: "main" },
  ]) {
    test(`load: ${label}`, async ({ page }) => {
      const ms = await timed(label, async () => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.locator(readySelector).waitFor({ state: "visible", timeout: T.publicPage + 1_000 });
      });
      expect(ms, `${label} took ${ms} ms — budget ${T.publicPage} ms`).toBeLessThan(T.publicPage);
    });
  }
});

// ─── 2. View-to-view navigation ───────────────────────────────────────────────

test.describe("Public views — navigation latency", () => {
  test("sequential: Gantt → Calendar → Agenda → Gantt (page.goto each)", async ({ page }) => {
    // First load to warm up the connection
    await page.goto("/demo-school", { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ state: "visible" });

    const hops: [string, number][] = [];

    for (const { label, path } of [
      { label: "→ Calendar", path: "/demo-school/calendar" },
      { label: "→ Agenda", path: "/demo-school/agenda" },
      { label: "→ Gantt", path: "/demo-school" },
    ]) {
      const ms = await timed(`View switch ${label}`, async () => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.locator("main").waitFor({ state: "visible" });
      });
      hops.push([label, ms]);
      expect(ms, `${label} took ${ms} ms — budget ${T.publicPage} ms`).toBeLessThan(T.publicPage);
    }

    summary("View navigation", hops);
  });

  test("client-side nav via links: Gantt → Calendar → Agenda → Gantt", async ({ page }) => {
    await page.goto("/demo-school", { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ state: "visible" });

    const hops: [string, number][] = [];

    // Nav links rendered by AppHeaderNav use Hebrew labels (nav.* in messages/he.json):
    //   Gantt → "גאנט", Calendar → "לוח שנה", Agenda → "סדר יום"
    // Skipped gracefully when the school is not in the DB (nav header absent).
    for (const { label, linkName, urlPattern } of [
      { label: "→ Calendar (link)", linkName: "לוח שנה", urlPattern: /\/calendar/ },
      { label: "→ Agenda (link)", linkName: "סדר יום", urlPattern: /\/agenda/ },
      { label: "→ Gantt (link)", linkName: "גאנט", urlPattern: /demo-school$/ },
    ]) {
      const target = page.getByRole("link", { name: linkName });
      const isVisible = await target.isVisible().catch(() => false);
      if (!isVisible) {
        console.log(`[LATENCY] ${label}: nav link not found — run with a seeded DB to test client-side nav`);
        continue;
      }

      const ms = await timed(label, async () => {
        await target.click();
        await page.waitForURL(urlPattern, { timeout: 5_000 });
        await page.locator("main").waitFor({ state: "visible" });
      });
      hops.push([label, ms]);
      expect(ms, `${label} took ${ms} ms — budget 1500 ms`).toBeLessThan(1_500);
    }

    if (hops.length > 0) summary("Client-side nav", hops);
  });
});

// ─── 3. API endpoint raw latency ─────────────────────────────────────────────

test.describe("API endpoint latency (editor auth)", () => {
  test.skip(!authReady, "ADMIN_E2E=1 + DATABASE_URL required");
  test.use({ storageState: "test/e2e/.auth/editor.json" });

  test("GET /api/v1/admin/event-types", async ({ request }) => {
    const ms = await timed("GET /api/v1/admin/event-types", async () => {
      const res = await request.get("/api/v1/admin/event-types");
      expect(res.ok()).toBeTruthy();
    });
    expect(ms).toBeLessThan(T.apiCall);
  });

  test("POST /api/v1/events — create draft", async ({ request }) => {
    const etRes = await request.get("/api/v1/admin/event-types");
    if (!etRes.ok()) { test.skip(true, "event-types fetch failed"); return; }
    const { eventTypes } = (await etRes.json()) as { eventTypes: { id: string }[] };
    if (!eventTypes.length) { test.skip(true, "no event types seeded"); return; }

    const ms = await timed("POST /api/v1/events (create draft)", async () => {
      const res = await request.post("/api/v1/events", {
        data: { eventTypeId: eventTypes[0].id },
        headers: { "Content-Type": "application/json" },
      });
      expect(res.ok()).toBeTruthy();
    });
    expect(ms).toBeLessThan(T.apiCall);
  });

  test("PATCH /api/v1/events/:id — fill fields", async ({ request }) => {
    const etRes = await request.get("/api/v1/admin/event-types");
    if (!etRes.ok()) { test.skip(true, "event-types fetch failed"); return; }
    const { eventTypes } = (await etRes.json()) as { eventTypes: { id: string }[] };
    if (!eventTypes.length) { test.skip(true, "no event types seeded"); return; }

    const createRes = await request.post("/api/v1/events", {
      data: { eventTypeId: eventTypes[0].id },
      headers: { "Content-Type": "application/json" },
    });
    if (!createRes.ok()) { test.skip(true, "draft creation failed"); return; }
    const { id: eventId } = (await createRes.json()) as { id: string };

    const ms = await timed("PATCH /api/v1/events/:id (update fields)", async () => {
      const res = await request.patch(`/api/v1/events/${eventId}`, {
        data: {
          title: `Latency-PATCH-${Date.now()}`,
          grades: [10],
          eventTypeId: eventTypes[0].id,
          allDay: true,
          startAt: "2026-06-15T00:00:00+03:00",
          endAt: "2026-06-15T23:59:59+03:00",
        },
        headers: { "Content-Type": "application/json" },
      });
      expect(res.ok()).toBeTruthy();
    });
    expect(ms).toBeLessThan(T.apiCall);
  });

  test("POST /api/v1/events/:id/submit — publish", async ({ request }) => {
    const etRes = await request.get("/api/v1/admin/event-types");
    if (!etRes.ok()) { test.skip(true, "event-types fetch failed"); return; }
    const { eventTypes } = (await etRes.json()) as { eventTypes: { id: string }[] };
    if (!eventTypes.length) { test.skip(true, "no event types seeded"); return; }

    const createRes = await request.post("/api/v1/events", {
      data: { eventTypeId: eventTypes[0].id },
      headers: { "Content-Type": "application/json" },
    });
    if (!createRes.ok()) { test.skip(true, "draft creation failed"); return; }
    const { id: eventId } = (await createRes.json()) as { id: string };

    await request.patch(`/api/v1/events/${eventId}`, {
      data: {
        title: `Latency-SUBMIT-${Date.now()}`,
        grades: [10],
        eventTypeId: eventTypes[0].id,
        allDay: true,
        startAt: "2026-06-15T00:00:00+03:00",
        endAt: "2026-06-15T23:59:59+03:00",
      },
      headers: { "Content-Type": "application/json" },
    });

    const ms = await timed("POST /api/v1/events/:id/submit (publish)", async () => {
      const res = await request.post(`/api/v1/events/${eventId}/submit`);
      expect(res.ok()).toBeTruthy();
    });
    expect(ms).toBeLessThan(T.publishApi);
  });
});

// ─── 4. Dashboard and staff pages ────────────────────────────────────────────

test.describe("Authenticated page latency — editor", () => {
  test.skip(!authReady, "ADMIN_E2E=1 + DATABASE_URL required");
  test.use({ storageState: "test/e2e/.auth/editor.json" });

  test("load: /dashboard", async ({ page }) => {
    const ms = await timed("/dashboard (editor)", async () => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.locator("main").waitFor({ state: "visible" });
    });
    expect(ms).toBeLessThan(T.adminPage);
  });

  test("load: /events/new (wizard step 1)", async ({ page }) => {
    const ms = await timed("/events/new (step 1 visible)", async () => {
      await page.goto("/events/new", { waitUntil: "domcontentloaded" });
      await page.locator('input[type="date"]').waitFor({ state: "visible" });
    });
    expect(ms).toBeLessThan(T.adminPage);
  });
});

test.describe("Authenticated page latency — admin", () => {
  test.skip(!authReady, "ADMIN_E2E=1 + DATABASE_URL required");
  test.use({ storageState: "test/e2e/.auth/admin.json" });

  for (const { label, path } of [
    { label: "/admin/staff", path: "/admin/staff" },
    { label: "/admin/year", path: "/admin/year" },
    { label: "/admin/event-types", path: "/admin/event-types" },
  ]) {
    test(`load: ${label}`, async ({ page }) => {
      const ms = await timed(`${label} page load`, async () => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.locator("main").waitFor({ state: "visible" });
      });
      expect(ms).toBeLessThan(T.adminPage);
    });
  }

  test("API: GET /api/v1/admin/years", async ({ request }) => {
    const ms = await timed("GET /api/v1/admin/years", async () => {
      const res = await request.get("/api/v1/admin/years");
      expect(res.ok()).toBeTruthy();
    });
    expect(ms).toBeLessThan(T.apiCall);
  });

  test("admin invite — form submit latency", async ({ page }) => {
    await page.goto("/admin/staff", { waitUntil: "domcontentloaded" });
    const form = page.locator('form:has(input[name="email"])');
    await expect(form).toBeVisible({ timeout: 5_000 });

    await form.locator('select[name="role"]').selectOption("editor");
    await form.locator('input[name="email"]').fill(`latency-${Date.now()}@demo-school.test`);
    // Grade checkbox — try grade-10; fall back if label differs
    const gradeBox = form.locator('input[name="invite-grade-10"]');
    if (await gradeBox.isVisible()) await gradeBox.check();

    const ms = await timed("Admin invite form submit → invite URL visible", async () => {
      await form.locator('button[type="submit"]').click();
      await expect(page.getByText(/\/invite\//)).toBeVisible({ timeout: T.adminAction });
    });
    expect(ms).toBeLessThan(T.adminAction);
  });
});

// ─── 5. Wizard step-by-step timing ───────────────────────────────────────────

test.describe("Wizard step latency (editor auth)", () => {
  test.skip(!authReady, "ADMIN_E2E=1 + DATABASE_URL required");
  test.use({ storageState: "test/e2e/.auth/editor.json" });

  test("7-step wizard — per-step timings", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/events/new", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="date"]').waitFor({ state: "visible" });

    const nextBtn = () =>
      page.getByRole("main").getByRole("button", { name: "הבא" }).first();

    const step1 = await timed("Wizard step 1→2 (date → grades)", async () => {
      await page.locator('input[type="date"]').fill("2026-06-15");
      await nextBtn().click();
      await page.getByRole("main").getByRole("button", { name: /ז|ח|ט|י|כ/ }).first()
        .waitFor({ state: "visible", timeout: T.wizardStep + 500 });
    });

    const step2 = await timed("Wizard step 2→3 (grades → event type)", async () => {
      await page.getByRole("main").getByRole("button", { name: /ז|ח|ט|י|כ/ }).first().click();
      await nextBtn().click();
      await page.getByRole("main").getByRole("radio").first()
        .waitFor({ state: "visible", timeout: T.wizardStep + 500 });
    });

    const step3 = await timed("Wizard step 3→4 (event type → title)", async () => {
      await page.getByRole("main").getByRole("radio").first().click();
      await nextBtn().click();
      await page.getByRole("main").locator('input[type="text"]')
        .waitFor({ state: "visible", timeout: T.wizardStep + 500 });
    });

    const step4 = await timed("Wizard step 4→5 (title → time)", async () => {
      await page.getByRole("main").locator('input[type="text"]').fill("Latency Test Event");
      await nextBtn().click();
      // Step 5 (time) — next button re-appears when step renders
      await nextBtn().waitFor({ state: "visible", timeout: T.wizardStep + 500 });
    });

    const step5 = await timed("Wizard step 5→6 (time → responsible)", async () => {
      await nextBtn().click();
      await page.getByRole("main").locator('input[type="text"]')
        .waitFor({ state: "visible", timeout: T.wizardStep + 500 });
    });

    const step6 = await timed("Wizard step 6→7 (responsible → review/publish)", async () => {
      await page.getByRole("main").locator('input[type="text"]').fill("Test Coordinator");
      await nextBtn().click();
      await page.getByRole("main").getByRole("button", { name: /פרסם/ })
        .waitFor({ state: "visible", timeout: T.wizardStep + 500 });
    });

    const step7 = await timed("Wizard step 7: publish → dashboard", async () => {
      const submitBtn = page.getByRole("main").getByRole("button", { name: /פרסם/ });
      await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
      await submitBtn.click();
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    });

    const rows: [string, number][] = [
      ["Step 1 date → grades", step1],
      ["Step 2 grades → event type", step2],
      ["Step 3 event type → title", step3],
      ["Step 4 title → time", step4],
      ["Step 5 time → responsible", step5],
      ["Step 6 responsible → publish", step6],
      ["Step 7 publish → dashboard", step7],
    ];
    summary("Wizard steps", rows);

    const total = rows.reduce((sum, [, ms]) => sum + ms, 0);
    console.log(`[LATENCY]   Total wizard flow: ${total} ms`);

    for (const [label, ms] of rows) {
      expect(ms, `${label} took ${ms} ms — budget ${T.wizardStep} ms`).toBeLessThan(T.wizardStep);
    }
    expect(total, `Full wizard took ${total} ms — budget ${T.wizardTotal} ms`).toBeLessThan(T.wizardTotal);
  });
});

// ─── 6. Full end-to-end publish flow ─────────────────────────────────────────

test.describe("End-to-end publish latency", () => {
  test.skip(!authReady, "ADMIN_E2E=1 + DATABASE_URL required");
  // Uses admin auth because it fetches event-types from the admin endpoint
  test.use({ storageState: "test/e2e/.auth/admin.json" });

  test("create → patch → submit → event visible on public agenda", async ({ browser }) => {
    test.setTimeout(60_000);

    const adminCtx = await browser.newContext({ storageState: "test/e2e/.auth/admin.json" });
    const editorCtx = await browser.newContext({ storageState: "test/e2e/.auth/editor.json" });
    const publicCtx = await browser.newContext({ storageState: undefined });

    try {
      // Resolve an event type ID
      const etRes = await adminCtx.request.get("/api/v1/admin/event-types");
      expect(etRes.ok()).toBeTruthy();
      const { eventTypes } = (await etRes.json()) as { eventTypes: { id: string }[] };
      if (!eventTypes.length) { test.skip(true, "no event types seeded"); return; }
      const eventTypeId = eventTypes[0].id;

      const api = editorCtx.request;

      const createMs = await timed("POST /api/v1/events (create draft)", async () => {
        const res = await api.post("/api/v1/events", {
          data: { eventTypeId },
          headers: { "Content-Type": "application/json" },
        });
        expect(res.ok()).toBeTruthy();
      });

      // Create the real draft we'll use for the rest of the flow
      const createRes = await api.post("/api/v1/events", {
        data: { eventTypeId },
        headers: { "Content-Type": "application/json" },
      });
      const { id: eventId } = (await createRes.json()) as { id: string };
      const title = `LatencyE2E-${Date.now()}`;

      const patchMs = await timed("PATCH /api/v1/events/:id (title + grades + dates)", async () => {
        const res = await api.patch(`/api/v1/events/${eventId}`, {
          data: {
            title,
            grades: [10],
            eventTypeId,
            allDay: true,
            startAt: "2026-06-15T00:00:00+03:00",
            endAt: "2026-06-15T23:59:59+03:00",
          },
          headers: { "Content-Type": "application/json" },
        });
        expect(res.ok()).toBeTruthy();
      });

      const t0 = Date.now();

      const submitMs = await timed("POST /api/v1/events/:id/submit (publish)", async () => {
        const res = await api.post(`/api/v1/events/${eventId}/submit`);
        expect(res.ok()).toBeTruthy();
      });

      const publicPage = await publicCtx.newPage();
      const visibleMs = await timed("Public /agenda shows new event", async () => {
        await expect(async () => {
          await publicPage.goto(`/demo-school/agenda?cb=${Date.now()}`);
          await expect(publicPage.getByText(title)).toBeVisible({ timeout: 2_000 });
        }).toPass({ timeout: 12_000 });
      });

      const submitToVisible = Date.now() - t0;

      summary("Publish flow", [
        ["Create draft (POST)", createMs],
        ["Fill fields (PATCH)", patchMs],
        ["Publish (POST /submit)", submitMs],
        ["Public agenda visible", visibleMs],
        ["Submit → visible (end-to-end)", submitToVisible],
      ]);

      expect(submitMs).toBeLessThan(T.publishApi);
      expect(submitToVisible).toBeLessThan(T.publishVisible);
    } finally {
      await adminCtx.close();
      await editorCtx.close();
      await publicCtx.close();
    }
  });
});
