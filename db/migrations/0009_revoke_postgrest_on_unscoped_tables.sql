-- Defense-in-depth for tables we intentionally leave without RLS:
--   * schools — slug lookup pre-auth (lib/db/schools.ts)
--   * pending_registrations — service-role only
-- The app never reads these via PostgREST; it uses the pg pool as the
-- bypassrls postgres role. Revoking grants from anon/authenticated removes
-- the /rest/v1/<table> attack surface that Supabase exposes by default.
REVOKE ALL ON TABLE "schools" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "pending_registrations" FROM "anon", "authenticated";
