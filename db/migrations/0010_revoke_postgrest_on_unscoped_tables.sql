-- Defense-in-depth for tables we intentionally leave without RLS:
--   * schools — slug lookup pre-auth (lib/db/schools.ts)
--   * pending_registrations — service-role only
-- The app never reads these via PostgREST; it uses the pg pool as the
-- bypassrls postgres role. Revoking grants from anon/authenticated removes
-- the /rest/v1/<table> attack surface that Supabase exposes by default.
-- Wrapped in DO blocks so the migration is no-op on plain Postgres (CI),
-- where the Supabase-only `anon`/`authenticated` roles do not exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "schools" FROM "anon"';
    EXECUTE 'REVOKE ALL ON TABLE "pending_registrations" FROM "anon"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "schools" FROM "authenticated"';
    EXECUTE 'REVOKE ALL ON TABLE "pending_registrations" FROM "authenticated"';
  END IF;
END $$;
