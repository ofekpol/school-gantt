// Load .env.local first (Next.js convention), then fall back to .env
// Required because tsx/vitest scripts don't use Next.js env loading
import { config } from "dotenv";
config({ path: ".env.local", override: false });
config({ override: false });
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL env var");
}

const pool = new Pool({ connectionString: databaseUrl, max: 10 });

export const db: NodePgDatabase<typeof schema> = drizzle({ client: pool, schema });

export { supabaseAdmin } from "./supabase-admin";

/**
 * Run `fn` with `app.school_id` set to `schoolId` via SET LOCAL semantics.
 * Wraps a transaction so the setting is bound to that transaction (Pitfall 1: research).
 * All queries inside `fn` are subject to school_isolation RLS policy.
 *
 * Usage:
 *   const events = await withSchool(schoolId, (tx) =>
 *     tx.select().from(events).where(eq(events.status, "approved"))
 *   );
 */
export async function withSchool<T>(
  schoolId: string,
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL ROLE authenticated: switch to a role subject to RLS within this transaction.
    // The postgres user has bypassrls=true, so without this SET ROLE, RLS policies are skipped.
    // SET LOCAL reverts automatically when the transaction ends.
    await tx.execute(sql`SET LOCAL ROLE authenticated`);
    // set_config(name, value, is_local=TRUE) → SET LOCAL: scoped to this transaction.
    // Without the transaction wrapper this is a no-op (Pitfall 1).
    await tx.execute(sql`SELECT set_config('app.school_id', ${schoolId}, TRUE)`);
    return fn(tx as NodePgDatabase<typeof schema>);
  });
}
