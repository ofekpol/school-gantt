-- `public.rls_auto_enable()` is a Supabase platform helper installed as
-- SECURITY DEFINER. By default PostgREST exposes it at /rest/v1/rpc/
-- to anon and authenticated (via the implicit PUBLIC grant). The app
-- never calls it; revoke EXECUTE from PUBLIC (and the two roles as
-- belt-and-braces) to close the unauthenticated RPC surface.
REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
