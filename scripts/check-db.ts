import { config } from "dotenv";
config({ path: ".env.local", override: false, quiet: true });
config({ override: false, quiet: true });

import { Pool } from "pg";
import { rethrowWithDatabaseHint } from "../lib/db/client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("✗ Database check failed");
    console.error("  DATABASE_URL not set. Add it to .env.local.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    console.log("✓ Database reachable");
  } catch (error) {
    console.error("✗ Database check failed");
    try {
      rethrowWithDatabaseHint(error, "");
    } catch (enhanced) {
      const msg = enhanced instanceof Error ? enhanced.message.replace(/^: /, "") : String(enhanced);
      console.error(`  ${msg}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
