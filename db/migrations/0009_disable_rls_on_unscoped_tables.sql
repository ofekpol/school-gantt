-- Supabase auto-enables RLS on every new table in the public schema.
-- Two tables in this schema are intentionally not RLS-scoped:
--   * schools — tenant root; queried by slug pre-auth (lib/db/schools.ts)
--   * pending_registrations — service-role only (Google OAuth landing)
-- Without an explicit policy, RLS-enabled tables block all non-bypassrls reads,
-- which breaks slug lookup inside withSchool() (runs as `authenticated`).
ALTER TABLE "schools" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "pending_registrations" DISABLE ROW LEVEL SECURITY;
