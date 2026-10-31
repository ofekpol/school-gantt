-- Platform (super) admins: Supabase Auth users allowed to provision schools
-- from /platform/schools. Not a tenant table: no school_id, no policies.
-- Only the server's pg pool (bypassrls) reads it. Rows are added by hand,
-- see OPERATIONS.md "Platform admins".
CREATE TABLE IF NOT EXISTS "platform_admins" (
  "auth_user_id" uuid PRIMARY KEY,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
-- RLS on with no policies: PostgREST roles see nothing even if granted.
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;
-- Same Supabase-only guard as 0010: no-op on plain Postgres (CI).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "platform_admins" FROM "anon"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "platform_admins" FROM "authenticated"';
  END IF;
END $$;
