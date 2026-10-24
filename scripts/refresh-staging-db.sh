#!/usr/bin/env bash
# Copies production data into the staging Supabase project (read-only on prod).
#
#   PROD_DATABASE_URL=... STAGING_DATABASE_URL=... bash scripts/refresh-staging-db.sh
#
# Use Supabase *session pooler* URLs (IPv4, supports pg_dump). Requires pg_dump/
# pg_restore/psql v17. After this, run `pnpm db:migrate` against staging so
# staging-only migrations re-apply on top of prod data.
set -euo pipefail

readonly PROD_REF="mfrtdirkknuvweaiqfzs"
readonly STAGING_REF="wmapfuwpdyishfqtzwha"

die() { echo "[refresh-staging] $*" >&2; exit 1; }

guard() {
  [[ -n "${PROD_DATABASE_URL:-}" ]] || die "PROD_DATABASE_URL is not set"
  [[ -n "${STAGING_DATABASE_URL:-}" ]] || die "STAGING_DATABASE_URL is not set"
  [[ "$PROD_DATABASE_URL" != "$STAGING_DATABASE_URL" ]] || die "source and target are the same"
  [[ "$STAGING_DATABASE_URL" != *"$PROD_REF"* ]] || die "target looks like PRODUCTION — refusing"
  [[ "$STAGING_DATABASE_URL" == *"$STAGING_REF"* ]] || die "target is not the staging project ($STAGING_REF)"
  [[ "$PROD_DATABASE_URL" == *"$PROD_REF"* ]] || die "source is not the production project ($PROD_REF)"
}

dump_prod() {
  local dir="$1"
  pg_dump "$PROD_DATABASE_URL" -Fc --no-owner --schema=public -f "$dir/public.dump"
  pg_dump "$PROD_DATABASE_URL" -Fc --data-only --table=auth.users --table=auth.identities -f "$dir/auth.dump"
  # Skip the schema entry, the Supabase platform helper, and default ACLs owned by
  # supabase_admin (non-superusers cannot set them; staging already has the same ones).
  pg_restore -l "$dir/public.dump" | grep -vE ' SCHEMA - public |rls_auto_enable| DEFAULT ACL ' > "$dir/all.list"
  grep -v ' ACL ' "$dir/all.list" > "$dir/objects.list"
  grep ' ACL ' "$dir/all.list" > "$dir/acl.list" || true
}

# Staging's default privileges auto-grant new tables to the API roles; strip those so
# only prod's exact grants (restored next from acl.list) remain — e.g. 0010's revokes.
reset_api_grants() {
  psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, service_role;
SQL
}

# Drops app objects in public; leaves the schema and Supabase's rls_auto_enable helper intact.
wipe_staging() {
  psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.viewname);
  END LOOP;
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.sequencename);
  END LOOP;
  FOR r IN SELECT t.typname FROM pg_type t
           WHERE t.typnamespace = 'public'::regnamespace AND t.typtype IN ('e', 'd') LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname <> 'rls_auto_enable' LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;
END $$;
TRUNCATE auth.users CASCADE;
SQL
}

restore_staging() {
  local dir="$1"
  pg_restore -d "$STAGING_DATABASE_URL" --no-owner --single-transaction --exit-on-error \
    -L "$dir/objects.list" "$dir/public.dump"
  reset_api_grants
  pg_restore -d "$STAGING_DATABASE_URL" --no-owner --single-transaction --exit-on-error \
    -L "$dir/acl.list" "$dir/public.dump"
  pg_restore -d "$STAGING_DATABASE_URL" --data-only --single-transaction --exit-on-error "$dir/auth.dump"
}

main() {
  guard
  dir="$(mktemp -d)" # global: the EXIT trap runs after main returns
  trap 'rm -rf "$dir"' EXIT
  echo "[refresh-staging] dumping production (read-only)"
  dump_prod "$dir"
  echo "[refresh-staging] wiping staging"
  wipe_staging
  echo "[refresh-staging] restoring into staging"
  restore_staging "$dir"
  echo "[refresh-staging] done"
}

main "$@"
