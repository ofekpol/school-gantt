import { chromium, type FullConfig } from "@playwright/test";
import path from "path";
import { Pool } from "pg";

/**
 * Playwright global setup — creates persisted auth state files for DB-dependent tests.
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
  if (process.env.ADMIN_E2E !== "1") return;

  await clearForcedPasswordChange();

  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  const authDir = path.join(process.cwd(), "test/e2e/.auth");

  const browser = await chromium.launch();

  try {
    await saveAuthState({
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

    await saveAuthState({
      browser,
      baseURL,
      email: "viewer@demo-school.test",
      password: "ChangeMe123!",
      outputPath: path.join(authDir, "viewer.json"),
    });
  } finally {
    await browser.close();
  }
}

/**
 * The demo seed forces a password change on first login, and the API answers 403
 * until it happens. The suite logs in with the seed password as-is, so clear the flag.
 */
async function clearForcedPasswordChange(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      "UPDATE staff_users SET must_change_password = false WHERE email LIKE '%@demo-school.test'",
    );
  } finally {
    await pool.end();
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
 * Legacy password-auth helper. It is only reachable when ADMIN_E2E=1; the
 * Google OAuth migration requires replacing this with an OAuth-aware test
 * fixture before those browser tests can be re-enabled.
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
    // The Next dev server can return a transient 5xx while a route is still
    // compiling (manifest write race). Retry a few times before giving up.
    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await context.request.post("/api/v1/auth/login", {
        data: { email, password },
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok()) {
        await context.storageState({ path: outputPath });
        return outputPath;
      }
      lastStatus = response.status();
      lastBody = await response.text();
      // Only retry on server-side errors; auth failures (4xx) are terminal.
      if (lastStatus < 500) break;
      await new Promise((r) => setTimeout(r, 1_000));
    }
    throw new Error(`Login failed for ${email} (${lastStatus}): ${lastBody}`);
  } finally {
    await context.close();
  }
}

export default globalSetup;
