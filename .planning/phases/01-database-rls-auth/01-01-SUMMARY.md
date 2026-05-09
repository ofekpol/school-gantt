---
phase: 01-database-rls-auth
plan: "01"
subsystem: database
tags: [drizzle-orm, postgres, rls, supabase, eslint, pg, zod]

requires:
  - phase: 00-foundation
    provides: Next.js 15 + TypeScript strict + Tailwind + CI toolchain

provides:
  - Drizzle pgTable schema for all 10 PRD tables with correct columns and types
  - Postgres RLS enabled + school_isolation pgPolicy on all 9 school-scoped tables
  - Initial migration SQL in db/migrations/0000_initial.sql (not yet applied)
  - Typed db export via drizzle-orm/node-postgres Pool
  - Restricted supabaseAdmin export (service-role client, lib/db/ only)
  - ESLint rule blocking supabaseAdmin imports outside lib/db/
  - drizzle.config.ts pointing to lib/db/schema.ts + db/migrations/

affects:
  - 01-02 (withSchool wrapper, seed script — imports schema and client)
  - 01-03 (auth session helper — imports db + supabaseAdmin)
  - 01-04 (login route — imports staffUsers schema, supabaseAdmin)
  - all subsequent phases that query school-scoped tables

tech-stack:
  added:
    - drizzle-orm@0.45.2
    - drizzle-kit@0.31.10
    - pg@8.20.0 + @types/pg@8.20.0
    - "@supabase/supabase-js@2.105.4"
    - "@supabase/ssr@0.10.3"
    - resend@6.12.3
    - zod@3.25.76
    - dotenv@17.4.2
  patterns:
    - "Shared schoolIsolation pgPolicy variable reused across 9 table definitions"
    - "lib/db/ is the restricted zone: supabaseAdmin lives only here, ESLint enforces"
    - "staffUsers.id = auth.users.id (no defaultRandom; seed sets it explicitly)"
    - "Migration files are additive-only: never edit existing SQL files"

key-files:
  created:
    - lib/db/schema.ts
    - lib/db/supabase-admin.ts
    - lib/db/client.ts
    - lib/db/index.ts
    - db/migrations/0000_initial.sql
    - db/migrations/meta/_journal.json
    - db/migrations/meta/0000_snapshot.json
    - drizzle.config.ts
  modified:
    - package.json (8 new runtime deps + 2 new dev deps)
    - pnpm-lock.yaml
    - eslint.config.mjs (no-restricted-imports rule + lib/db/ override)

key-decisions:
  - "staffUsers.id mirrors auth.users.id (no defaultRandom) so seed inserts with explicit UUIDs from Supabase Auth"
  - "schoolIsolation pgPolicy defined once as a shared const and referenced in all 9 table callbacks — reduces repetition"
  - "Migration named 0000_initial.sql (drizzle-kit default numbering) — 0001 is reserved for next schema change"
  - "Migration NOT applied yet — Plan 02 applies it alongside seed verification"
  - "supabaseAdmin moved to separate lib/db/supabase-admin.ts for cleaner ESLint rule targeting"

patterns-established:
  - "Pattern DB-RLS-01: pgPolicy('school_isolation') using NULLIF(current_setting('app.school_id', TRUE), '')::uuid on every school-scoped table"
  - "Pattern DB-IMPORT: lib/db/index.ts re-exports only db + schema — supabaseAdmin never crosses lib/db/ boundary"
  - "Pattern DB-ESLINT: no-restricted-imports global rule + lib/db/** override (override AFTER rule, Pitfall 4)"

requirements-completed: [DB-01, DB-02, DB-04]

duration: 5min
completed: "2026-05-09"
---

# Phase 01 Plan 01: Schema, Migration, and DB Clients Summary

**Drizzle schema for all 10 PRD tables with Postgres RLS school_isolation policies, initial migration SQL, typed db export, and ESLint rule restricting supabaseAdmin to lib/db/**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-09T14:46:05Z
- **Completed:** 2026-05-09T14:51:41Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Installed 8 runtime deps (drizzle-orm, pg, @supabase/supabase-js, @supabase/ssr, resend, zod, dotenv) and 2 dev deps (drizzle-kit, @types/pg); created drizzle.config.ts
- Defined all 10 PRD tables in lib/db/schema.ts (248 lines) with correct column types, pgEnums, composite PK on event_grades, indexes on events/revisions/audit_log/editor_scopes, and school_isolation pgPolicy on all 9 school-scoped tables; staffUsers.loginAttempts column present (Pitfall 6)
- Generated db/migrations/0000_initial.sql via drizzle-kit: 10 CREATE TABLE, 9 ENABLE ROW LEVEL SECURITY, 9 CREATE POLICY school_isolation; created lib/db/{supabase-admin,client,index}.ts; added ESLint no-restricted-imports rule with correct override order

## Task Commits

1. **Task 1.1: Install Drizzle + Supabase deps and create drizzle.config.ts** - `104499d` (chore)
2. **Task 1.2: Define full Drizzle schema** - `189c4b7` (feat)
3. **Task 1.3: Generate migration + db clients + ESLint restriction** - `d99f98c` (feat)

## Files Created/Modified

- `lib/db/schema.ts` - All 10 Drizzle pgTable definitions + 3 pgEnums + shared schoolIsolation pgPolicy
- `lib/db/supabase-admin.ts` - Service-role Supabase client (bypasses RLS; RESTRICTED import)
- `lib/db/client.ts` - Drizzle pg Pool + typed db export + re-export of supabaseAdmin
- `lib/db/index.ts` - Public re-export of db + schema only (no supabaseAdmin)
- `db/migrations/0000_initial.sql` - Initial schema migration (not yet applied)
- `db/migrations/meta/` - Drizzle-kit migration journal + snapshot
- `drizzle.config.ts` - Drizzle Kit config (schema: lib/db/schema.ts, out: db/migrations/)
- `eslint.config.mjs` - Added no-restricted-imports blocking supabaseAdmin outside lib/db/
- `package.json` / `pnpm-lock.yaml` - 10 new dependencies

## Decisions Made

- `staffUsers.id` has no `defaultRandom()` — the UUID is set explicitly to `auth.users.id` during seeding so the two tables share identity
- `schoolIsolation` defined as a shared pgPolicy variable (rather than repeating inline) to DRY up the 9 table definitions
- Migration file kept as `0000_initial.sql` (drizzle-kit default) — not renamed; `0001_*` reserved for next additive change
- Migration is NOT applied in this plan — Plan 02 applies it when running the seed script with a real database connection
- `supabaseAdmin` split into its own `lib/db/supabase-admin.ts` file so the ESLint rule can target the import path precisely

## Deviations from Plan

None — plan executed exactly as written. The `lib/db/index.ts` comment was adjusted to remove the literal string "supabaseAdmin" so the acceptance-criteria check (grep for the identifier) passes correctly.

## Issues Encountered

- The plan's verification check `if(/supabaseAdmin/.test(c))` for `index.ts` flagged the original comment that said "supabaseAdmin is intentionally NOT re-exported." Comment text was reworded to avoid the string while preserving the intent. Not a bug — just a documentation phrasing issue.

## User Setup Required

None - no external service configuration required in this plan. Migration will be applied in Plan 02 after env vars are supplied (D-02 checkpoint).

## Known Stubs

None — this plan creates schema infrastructure only (no UI, no data flow, no placeholder values).

## Next Phase Readiness

- Plan 02 can import from `lib/db/schema.ts` and `lib/db/client.ts` to implement `withSchool()` and the seed script
- Migration is ready to apply — requires `DATABASE_URL` env var (handled by Plan 02's D-02 checkpoint)
- ESLint is enforcing the supabaseAdmin boundary — any accidental import outside lib/db/ will fail lint

---
*Phase: 01-database-rls-auth*
*Completed: 2026-05-09*
