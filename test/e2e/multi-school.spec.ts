import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { Pool } from "pg";

/**
 * Two schools side by side: the demo seed's `demo-school` plus a
 * `second-school` this spec upserts directly. Covers the unauthenticated
 * surfaces; admin-side isolation lives in test/integration/cross-school.test.ts.
 */
test.skip(!process.env.DATABASE_URL, "DATABASE_URL required — skipping DB-dependent e2e");

const SECOND_SLUG = "second-school";
const SECOND_EVENT = "Second School Only Event";

async function upsertSecondSchool(pool: Pool): Promise<void> {
  const school = await pool.query<{ id: string }>(
    `INSERT INTO schools (slug, name) VALUES ($1, 'Second School')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [SECOND_SLUG],
  );
  const schoolId = school.rows[0].id;
  const eventType = await pool.query<{ id: string }>(
    `INSERT INTO event_types (school_id, key, label_he, label_en, color_hex, glyph)
     VALUES ($1, 'general', 'כללי', 'General', '#aec7e8', 'G')
     ON CONFLICT (school_id, key) DO UPDATE SET label_en = EXCLUDED.label_en RETURNING id`,
    [schoolId],
  );
  const staffId = randomUUID();
  await pool.query(
    `INSERT INTO staff_users (id, school_id, email, full_name, role)
     VALUES ($1, $2, $3, 'Second Admin', 'admin') ON CONFLICT (email) DO NOTHING`,
    [staffId, schoolId, "admin@second-school.test"],
  );
  const staff = await pool.query<{ id: string }>(
    "SELECT id FROM staff_users WHERE email = 'admin@second-school.test'",
  );
  const existing = await pool.query("SELECT 1 FROM events WHERE school_id = $1 AND title = $2", [
    schoolId,
    SECOND_EVENT,
  ]);
  if (existing.rowCount) return;
  const event = await pool.query<{ id: string }>(
    `INSERT INTO events (school_id, event_type_id, title, start_at, end_at, all_day, status, created_by)
     VALUES ($1, $2, $3, now() + interval '1 day', now() + interval '1 day 2 hours', false, 'approved', $4)
     RETURNING id`,
    [schoolId, eventType.rows[0].id, SECOND_EVENT, staff.rows[0].id],
  );
  await pool.query("INSERT INTO event_grades (event_id, grade, school_id) VALUES ($1, 10, $2)", [
    event.rows[0].id,
    schoolId,
  ]);
}

test.beforeAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await upsertSecondSchool(pool);
  } finally {
    await pool.end();
  }
});

test("MULTI: /schedule offers a school picker", async ({ page }) => {
  await page.goto("/schedule");
  await expect(page.getByRole("link", { name: "Demo School" })).toBeVisible();
  await page.getByRole("link", { name: "Second School" }).click();
  await expect(page).toHaveURL(/\/schedule\?school=second-school$/);
});

test("MULTI: each public agenda shows only its own school's events", async ({ page }) => {
  await page.goto(`/${SECOND_SLUG}/agenda`);
  await expect(page.getByText(SECOND_EVENT).first()).toBeVisible({ timeout: 20_000 });

  await page.goto("/demo-school/agenda");
  await expect(page.getByText(SECOND_EVENT)).toHaveCount(0);
});

test("MULTI: a school sign-up link shows the school and keeps it on register", async ({ page }) => {
  await page.goto(`/auth/login?school=${SECOND_SLUG}`);
  await expect(page.getByText("Second School")).toBeVisible();
  await page.getByRole("link", { name: "הרשמה" }).click();
  await expect(page).toHaveURL(/\/auth\/register\?school=second-school/);
  await expect(page.getByText("Second School")).toBeVisible();
});

test("MULTI: a malformed or unknown ?school= is ignored", async ({ page }) => {
  for (const bad of ["..%2Fx", "UPPER", "no-such-school"]) {
    const res = await page.goto(`/auth/login?school=${bad}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "כניסה למערכת" })).toBeVisible();
  }
});
