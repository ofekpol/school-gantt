import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

/**
 * Idempotent migration runner.
 *
 * Tracks applied migrations in `public.app_migrations(name PK)`. On each run:
 *   1. Ensure tracking table exists.
 *   2. List db/migrations/*.sql alphabetically.
 *   3. For each not-yet-applied file: BEGIN; execute SQL; INSERT name; COMMIT.
 *
 * Designed to be safe to run on every Vercel build:
 *   - No-op when all migrations already applied.
 *   - Each migration is its own transaction; one failure aborts the whole run.
 *   - Does NOT use drizzle-kit (prod was bootstrapped via MCP, so the
 *     drizzle migrations table doesn't exist and replaying everything
 *     would fail on existing tables).
 *
 * Skip with `SKIP_MIGRATIONS=1` if needed (e.g. emergency Vercel deploys).
 */

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

async function main(): Promise<void> {
  if (process.env.SKIP_MIGRATIONS === "1") {
    console.log("[migrate] SKIP_MIGRATIONS=1 set — skipping.");
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("[migrate] DATABASE_URL not set — skipping (likely build sandbox).");
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.app_migrations (
        name        text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      );
    `);

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const { rows: appliedRows } = await pool.query<{ name: string }>(
      "SELECT name FROM public.app_migrations",
    );
    const applied = new Set(appliedRows.map((r) => r.name));

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log(`[migrate] up to date (${files.length} applied).`);
      return;
    }

    console.log(`[migrate] applying ${pending.length} migration(s)...`);
    for (const file of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO public.app_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate]   ✓ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        console.error(`[migrate]   ✗ ${file}`);
        throw err;
      } finally {
        client.release();
      }
    }
    console.log("[migrate] done.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("[migrate] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
