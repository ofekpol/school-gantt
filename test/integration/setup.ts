import "dotenv/config";
import { afterAll, beforeAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export const skipIfNoTestDb = !TEST_DATABASE_URL;

export const testPool = TEST_DATABASE_URL
  ? new Pool({ connectionString: TEST_DATABASE_URL, max: 5 })
  : null;

export const testDb = testPool ? drizzle({ client: testPool }) : null;

beforeAll(() => {
  if (skipIfNoTestDb) {
    console.warn("[integration] TEST_DATABASE_URL not set — integration tests will be skipped");
  }
});

afterAll(async () => {
  if (testPool) await testPool.end();
});
