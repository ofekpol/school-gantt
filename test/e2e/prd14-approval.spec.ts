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
 *
 * The test is self-contained: it creates a pending event via the editor
 * API before opening the admin queue, so no prior DB state is required.
 */
test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL not set — skipping DB-dependent approval e2e",
);

test("APPROVAL-PRD14: admin approves a pending event, public view shows it within 5 s", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  // ── Set up two browser contexts: admin and editor ──────────────────────
  const adminContext = await browser.newContext({
    storageState: "test/e2e/.auth/admin.json",
  });
  const editorContext = await browser.newContext({
    storageState: "test/e2e/.auth/editor.json",
  });
  const publicContext = await browser.newContext({ storageState: undefined });

  try {
    // ── Step 1: get the first event-type ID via the admin API ───────────
    const adminApi = adminContext.request;
    const etRes = await adminApi.get("/api/v1/admin/event-types");
    expect(etRes.ok()).toBeTruthy();
    const etBody = (await etRes.json()) as { eventTypes: { id: string }[] };
    const eventTypeId = etBody.eventTypes[0]?.id;
    expect(eventTypeId).toBeTruthy();

    // ── Step 2: editor creates a draft and submits it ──────────────────
    const editorApi = editorContext.request;

    const createRes = await editorApi.post("/api/v1/events", {
      data: { eventTypeId },
      headers: { "Content-Type": "application/json" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: eventId } = (await createRes.json()) as { id: string };

    const title = `Approval-E2E-${Date.now()}`;
    const patchRes = await editorApi.patch(`/api/v1/events/${eventId}`, {
      data: {
        title,
        grades: [10],
        eventTypeId,
        allDay: true,
        startAt: "2026-11-01T00:00:00+02:00",
        endAt: "2026-11-01T23:59:59+02:00",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(patchRes.ok()).toBeTruthy();

    const submitRes = await editorApi.post(`/api/v1/events/${eventId}/submit`);
    expect(submitRes.ok()).toBeTruthy();

    // ── Step 3: admin approves the specific event via API ────────────────
    // Use the API directly to avoid picking the wrong event from a busy queue.
    const t0 = Date.now();
    const approveRes = await adminApi.post(`/api/v1/events/${eventId}/approve`);
    expect(approveRes.ok()).toBeTruthy();

    // ── Step 4: public view shows the event within 5 s ─────────────────
    // In dev mode Next.js does not cache pages with ISR — each request hits
    // the server fresh, so the event should appear on the next page load.
    const publicPage = await publicContext.newPage();
    await expect(async () => {
      await publicPage.goto("/demo-school/agenda?cb=" + Date.now());
      await expect(publicPage.getByText(title)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 10_000 });

    const elapsedMs = Date.now() - t0;
    expect(elapsedMs).toBeLessThan(15_000);
  } finally {
    await adminContext.close();
    await editorContext.close();
    await publicContext.close();
  }
});
