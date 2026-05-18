// Load .env.local first (Next.js convention), then fall back to .env
// dotenv v17 (dotenvx) loads only the specified path; explicit .env.local is required for integration tests
import { config } from "dotenv";
config({ path: ".env.local", override: false });
config({ override: false });
import { afterAll, beforeAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/**
 * skipIfNoTestDb is true when:
 * - TEST_DATABASE_URL is not set, OR
 * - The DB is set but unreachable (checked in beforeAll and toggled at runtime).
 *
 * Test files that use `describe.skipIf(skipIfNoTestDb)` must re-read this via
 * the `shouldSkip()` helper which reflects the runtime connectivity check.
 */
let _skip = !TEST_DATABASE_URL;
/** @deprecated Use shouldSkip() for runtime-accurate skip checks */
export const skipIfNoTestDb = !TEST_DATABASE_URL;

/** Runtime-accurate: true if DB is absent OR unreachable after connectivity check */
export function shouldSkip(): boolean {
  return _skip;
}

const testPool = TEST_DATABASE_URL
  ? new Pool({ connectionString: TEST_DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 })
  : null;

export const testDb: NodePgDatabase<typeof schema> | null =
  testPool ? drizzle({ client: testPool, schema }) : null;

export const testSchoolA = "00000000-0000-0000-0000-00000000000a";
export const testSchoolB = "00000000-0000-0000-0000-00000000000b";

beforeAll(async () => {
  if (_skip || !testDb || !testPool) {
    console.warn("[integration] TEST_DATABASE_URL not set — skipping");
    return;
  }
  // Verify connectivity before running setup queries; if the DB is unreachable,
  // treat it the same as "no test DB" so tests skip cleanly instead of timing out.
  try {
    await testPool.query("SELECT 1");
  } catch (err) {
    console.warn("[integration] TEST_DATABASE_URL unreachable — skipping:", (err as Error).message);
    _skip = true;
    return;
  }
  // DB is reachable — reset skip flag and proceed with setup
  _skip = false;
  // Upsert two test schools (idempotent for repeated test runs)
  await testDb
    .insert(schema.schools)
    .values([
      { id: testSchoolA, slug: "test-a", name: "Test School A" },
      { id: testSchoolB, slug: "test-b", name: "Test School B" },
    ])
    .onConflictDoNothing();
  // Each school has one event_type for cross-tenant query tests
  await testDb
    .insert(schema.eventTypes)
    .values([
      {
        schoolId: testSchoolA,
        key: "trip",
        labelHe: "טיול",
        labelEn: "Trip",
        colorHex: "#ff0000",
        glyph: "T",
      },
      {
        schoolId: testSchoolB,
        key: "trip",
        labelHe: "טיול",
        labelEn: "Trip",
        colorHex: "#00ff00",
        glyph: "T",
      },
    ])
    .onConflictDoNothing();
});

// Skip individual test cases when the DB is unavailable at runtime.
// This handles the case where TEST_DATABASE_URL is set but unreachable —
// describe.skipIf() alone won't catch this because it's evaluated synchronously
// at import time before the async connectivity check in beforeAll runs.
beforeEach((ctx) => {
  if (_skip) ctx.skip();
});

afterAll(async () => {
  if (!testPool) return;
  try {
    await testPool.end();
  } catch {
    // Ignore errors when ending a pool that never connected successfully
  }
});
