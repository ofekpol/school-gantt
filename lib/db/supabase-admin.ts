import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// Load .env.local before checking env vars (required for tsx/vitest scripts)
import { config } from "dotenv";
config({ path: ".env.local", override: false });
config({ override: false });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
  );
}

/**
 * Service-role Supabase client. Bypasses RLS.
 * RESTRICTED: importable only from inside lib/db/ (enforced by ESLint).
 */
export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
