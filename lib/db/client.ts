import "dotenv/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL env var");
}

const pool = new Pool({ connectionString: databaseUrl, max: 10 });

export const db: NodePgDatabase<typeof schema> = drizzle({ client: pool, schema });

export { supabaseAdmin } from "./supabase-admin";
// withSchool() is added in Plan 02 — do not implement here.
