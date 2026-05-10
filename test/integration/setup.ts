// Load .env.local first (Next.js convention), then fall back to .env
// dotenv v17 (dotenvx) loads only the specified path; explicit .env.local is required for integration tests
import { config } from "dotenv";
config({ path: ".env.local", override: false });
config({ override: false });
import { afterAll, beforeAll } from "vitest";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const skipIfNoTestDb = !TEST_DATABASE_URL;

const testPool = TEST_DATABASE_URL
  ? new Pool({ connectionString: TEST_DATABASE_URL, max: 5 })
  : null;

export const testDb: NodePgDatabase<typeof schema> | null =
  testPool ? drizzle({ client: testPool, schema }) : null;

export const testSchoolA = "00000000-0000-0000-0000-00000000000a";
export const testSchoolB = "00000000-0000-0000-0000-00000000000b";

beforeAll(async () => {
  if (skipIfNoTestDb || !testDb) {
    console.warn("[integration] TEST_DATABASE_URL not set — skipping");
    return;
  }
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

afterAll(async () => {
  if (!testDb || !testPool) return;
  // Cleanup: delete child rows that lack ON DELETE CASCADE before deleting schools
  await testDb.execute(
    sql`DELETE FROM event_types WHERE school_id IN (${testSchoolA}::uuid, ${testSchoolB}::uuid)`,
  );
  await testDb.execute(
    sql`DELETE FROM schools WHERE id IN (${testSchoolA}::uuid, ${testSchoolB}::uuid)`,
  );
  await testPool.end();
});
