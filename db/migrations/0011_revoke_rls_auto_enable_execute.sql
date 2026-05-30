-- `public.rls_auto_enable()` is a Supabase platform helper installed as
-- SECURITY DEFINER. By default PostgREST exposes it at /rest/v1/rpc/
-- to anon and authenticated (via the implicit PUBLIC grant). The app
-- never calls it; revoke EXECUTE from PUBLIC (and the two roles as
-- belt-and-braces) to close the unauthenticated RPC surface.
-- Guarded so the migration is a no-op on plain Postgres (CI), where
-- neither the function nor the Supabase-only roles exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM "anon"';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM "authenticated"';
    END IF;
  END IF;
END $$;
