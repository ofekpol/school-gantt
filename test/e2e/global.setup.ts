import { chromium, type FullConfig } from "@playwright/test";
import path from "path";

/**
 * Playwright global setup — creates persisted auth state files and ensures
 * the demo school has an active academic year for DB-dependent tests.
 *
 * Auth state files are saved to test/e2e/.auth/ and consumed via
 * `storageState` in individual spec files. This avoids repeating the
 * login flow on every test.
 *
 * Credentials come from the demo seed (db/seed.ts):
 *   Admin:  admin@demo-school.test / ChangeMe123!
 *   Editor: grade10@demo-school.test / ChangeMe123!
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  const authDir = path.join(process.cwd(), "test/e2e/.auth");

  const browser = await chromium.launch();

  try {
    const adminState = await saveAuthState({
      browser,
      baseURL,
      email: "admin@demo-school.test",
      password: "ChangeMe123!",
      outputPath: path.join(authDir, "admin.json"),
    });

    await saveAuthState({
      browser,
      baseURL,
      email: "grade10@demo-school.test",
      password: "ChangeMe123!",
      outputPath: path.join(authDir, "editor.json"),
    });

    // Ensure the demo school has an active academic year so that wizard,
    // Gantt page, and approval tests can create events.
    await ensureActiveYear({ browser, baseURL, adminStorageState: adminState });
  } finally {
    await browser.close();
  }
}

interface SaveAuthOptions {
  browser: import("@playwright/test").Browser;
  baseURL: string;
  email: string;
  password: string;
  outputPath: string;
}

/**
 * Calls POST /api/v1/auth/login in a fresh browser context so that Supabase
 * SSR sets the session cookies on the response. Saves the resulting cookie
 * jar to disk as a Playwright storage-state file and returns the serialized
 * state for reuse.
 */
async function saveAuthState({
  browser,
  baseURL,
  email,
  password,
  outputPath,
}: SaveAuthOptions): Promise<string> {
  const context = await browser.newContext({ baseURL });
  try {
    const response = await context.request.post("/api/v1/auth/login", {
      data: { email, password },
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Login failed for ${email} (${response.status()}): ${body}`,
      );
    }

    await context.storageState({ path: outputPath });
    return outputPath;
  } finally {
    await context.close();
  }
}

interface EnsureYearOptions {
  browser: import("@playwright/test").Browser;
  baseURL: string;
  adminStorageState: string;
}

/**
 * Uses the admin API to verify an active academic year exists.
 * If none is present, creates one that spans the current school year
 * (Sept 1 of the current/previous calendar year → Jul 31 of the following).
 * Idempotent: if an active year already exists the setup is a no-op.
 */
async function ensureActiveYear({
  browser,
  baseURL,
  adminStorageState,
}: EnsureYearOptions): Promise<void> {
  const context = await browser.newContext({
    baseURL,
    storageState: adminStorageState,
  });
  try {
    // Check existing years — list endpoint returns all years for the school.
    const listRes = await context.request.get("/api/v1/admin/years");
    if (!listRes.ok()) {
      throw new Error(`Failed to list academic years: ${listRes.status()}`);
    }
    const { years } = (await listRes.json()) as {
      years: { id: string; startDate: string }[];
    };

    // Check if the school already has an active year by requesting the
    // Gantt page — if it shows "noActiveYear" the school.active_academic_year_id is null.
    // Use the years list: if any year exists, activate the most recent one.
    if (years.length > 0) {
      // A year exists; activate the most recent (first in desc-startDate order).
      const mostRecent = years[0];
      const patchRes = await context.request.patch(
        `/api/v1/admin/years/${mostRecent.id}`,
        {
          data: { setActive: true },
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!patchRes.ok()) {
        throw new Error(`Failed to activate year ${mostRecent.id}: ${patchRes.status()}`);
      }
      return;
    }

    // No year exists — create one for the current school year.
    const now = new Date();
    const startYear =
      now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const createRes = await context.request.post("/api/v1/admin/years", {
      data: {
        label: `${startYear}-${startYear + 1}`,
        startDate: `${startYear}-09-01`,
        endDate: `${startYear + 1}-07-31`,
        setActive: true,
      },
      headers: { "Content-Type": "application/json" },
    });
    if (!createRes.ok()) {
      const body = await createRes.text();
      throw new Error(
        `Failed to create academic year: ${createRes.status()} ${body}`,
      );
    }
  } finally {
    await context.close();
  }
}

export default globalSetup;
