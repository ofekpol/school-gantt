import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// Load .env.local before checking env vars (required for tsx/vitest scripts)
import { config } from "dotenv";
config({ path: ".env.local", override: false });
config({ override: false });

/**
 * Service-role Supabase client. Bypasses RLS.
 * RESTRICTED: importable only from inside lib/db/ (enforced by ESLint).
 *
 * Lazy singleton: throws only on first use (not at module load) so Next.js
 * production build can collect page data for API routes without requiring
 * env vars to be present in the build environment.
 */
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  }
  _supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabaseAdmin;
}

/**
 * Named export for backwards compatibility with existing imports.
 * @deprecated Use getSupabaseAdmin() for lazy initialization.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseAdmin()[prop as keyof SupabaseClient];
  },
});
