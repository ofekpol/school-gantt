---
phase: 01-database-rls-auth
plan: 02
subsystem: database
tags: [drizzle-orm, postgres, rls, supabase, vitest, integration-tests, seed]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Drizzle schema (schema.ts), migration file (0000_initial.sql), ESLint DB-04 override"
provides:
  - "withSchool(schoolId, fn) — transaction wrapper enforcing RLS via SET LOCAL ROLE + set_config"
  - "lib/db/index.ts re-exports withSchool"
  - "0000_initial.sql migration applied to Supabase (10 tables, 9 with RLS)"
  - "0001_force_rls.sql migration applied — FORCE ROW LEVEL SECURITY on 9 tables"
  - "db/seed.ts — idempotent canonical bootstrap: 1 school + 1 admin + 6 grade editors + 1 counselor + 11 event types"
  - "test/integration/rls.test.ts — 3 passing RLS isolation tests (DB-02, DB-03, DB-05)"
  - "test/integration/seed.test.ts — 6 passing seed verification tests (DB-06)"
affects:
  - auth
  - events
  - views
  - all later phases using withSchool

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "withSchool pattern: SET LOCAL ROLE authenticated + set_config(app.school_id, ..., TRUE) inside db.transaction"
    - "FORCE ROW LEVEL SECURITY required for postgres bypassrls user to be subject to RLS"
    - "Seed uses withSchool for school-scoped inserts (RLS-compatible)"
    - "dotenv .env.local loading: config({ path: '.env.local', override: false }) before config()"
    - "Integration test setup: two-school fixture with beforeAll/afterAll; cleanup deletes child rows before schools"
    - "Vitest beforeAll timeout: 60000ms for seed tests (Supabase auth.admin.createUser is slow)"

key-files:
  created:
    - db/seed.ts
    - db/migrations/0001_force_rls.sql
    - test/integration/rls.test.ts (replaced stubs)
    - test/integration/seed.test.ts (replaced stubs)
  modified:
    - lib/db/client.ts (added withSchool, changed dotenv loading)
    - lib/db/index.ts (re-export withSchool)
    - lib/db/supabase-admin.ts (changed dotenv loading)
    - test/integration/setup.ts (replaced stub with two-school fixture)
    - db/migrations/meta/_journal.json (added 0001 entry)
    - .env.local (set TEST_DATABASE_URL)
    - .gitignore (added scripts/)

key-decisions:
  - "withSchool uses SET LOCAL ROLE authenticated inside the transaction — postgres user has bypassrls=true so without SET ROLE, RLS is skipped even with FORCE ROW LEVEL SECURITY"
  - "FORCE ROW LEVEL SECURITY added via 0001_force_rls.sql — does NOT override bypassrls attribute but required for correctness documentation and future non-bypassrls connections"
  - "Seed uses withSchool for school-scoped inserts — necessary because FORCE ROW LEVEL SECURITY is active; schools table (no RLS) inserted directly"
  - "dotenv .env.local loading added to lib/db/supabase-admin.ts — module-level env var check runs before seed.ts/setup.ts body code due to CJS import hoisting"
  - "TEST_DATABASE_URL set to same value as DATABASE_URL — using same Supabase project for integration tests"
  - "Integration test cleanup: delete event_types before schools (FK without ON DELETE CASCADE on event_types.school_id)"

patterns-established:
  - "Pattern: Every withSchool call uses SET LOCAL ROLE authenticated + set_config — both required for RLS in postgres connections"
  - "Pattern: Seed creates school first (no RLS), then wraps all child inserts in withSchool"
  - "Pattern: Dotenv loading order — always load .env.local first, then .env; apply in supabase-admin.ts not just client.ts"

requirements-completed:
  - DB-03
  - DB-05
  - DB-06

# Metrics
duration: 68min
completed: 2026-05-10
---

# Phase 1 Plan 2: withSchool RLS Wrapper, Migration, and Seed Summary

**Postgres RLS enforced via withSchool transaction wrapper (SET LOCAL ROLE authenticated + set_config), migration applied, and idempotent seed creating 1 school + 8 staff users + 11 event types with passing integration tests**

## Performance

- **Duration:** 68 min
- **Started:** 2026-05-10T17:16:00Z
- **Completed:** 2026-05-10T18:24:52Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Applied 0000_initial.sql migration to Supabase: 10 tables created, 9 with RLS enabled
- Implemented withSchool<T>(schoolId, fn) that correctly enforces RLS isolation via two-step approach: SET LOCAL ROLE + set_config
- Added FORCE ROW LEVEL SECURITY migration (0001) to document intent; key insight: postgres user requires SET ROLE to be subject to RLS
- Built idempotent db/seed.ts creating canonical demo school with all 8 staff users and 11 event types via onConflictDoUpdate
- 9 integration tests passing: 3 RLS isolation tests (DB-02, DB-03, DB-05) + 6 seed verification tests (DB-06)

## Task Commits

1. **Task 2.1: withSchool wrapper + migration + RLS integration tests** - `8ed2519` (feat)
2. **Task 2.2: Seed script + seed integration tests** - `a3e6468` (feat)

## Files Created/Modified

- `lib/db/client.ts` - Added withSchool function with SET LOCAL ROLE + SET LOCAL set_config; updated dotenv loading
- `lib/db/index.ts` - Re-exports withSchool alongside db
- `lib/db/supabase-admin.ts` - Loads .env.local before checking env vars (CJS hoisting issue fix)
- `db/seed.ts` - Idempotent seed: school, academic year, admin, 6 grade editors, counselor, 11 event types
- `db/migrations/0001_force_rls.sql` - FORCE ROW LEVEL SECURITY on 9 school-scoped tables
- `db/migrations/meta/_journal.json` - Registered migration 0001
- `test/integration/setup.ts` - Two-school fixture (testSchoolA/B) with event types; cleanup order fix
- `test/integration/rls.test.ts` - 3 tests: withSchool(A) sees only A, withSchool(B) sees only B, cross-school returns empty
- `test/integration/seed.test.ts` - 6 tests verifying canonical bootstrap data + idempotency

## Decisions Made

- **SET LOCAL ROLE authenticated inside withSchool:** The postgres user in Supabase has `bypassrls=true`, meaning it skips RLS even with FORCE ROW LEVEL SECURITY. Using `SET LOCAL ROLE authenticated` (a non-bypassrls role that postgres is a member of) makes RLS policies apply within the transaction.
- **FORCE ROW LEVEL SECURITY still applied:** Although it doesn't override bypassrls, it ensures RLS is enforced for any future connections that don't use SET ROLE, and documents the intent clearly in the schema.
- **Seed uses withSchool for child inserts:** With FORCE RLS active, the postgres user inside withSchool (after SET ROLE) is subject to RLS. The seed wraps all school-scoped inserts in withSchool(school.id, ...) for correctness.
- **dotenv loading fixed in supabase-admin.ts:** CJS import hoisting causes supabase-admin.ts to execute before any dotenv.config() call in the importing module. Adding dotenv loading directly to supabase-admin.ts ensures env vars are available.
- **TEST_DATABASE_URL = DATABASE_URL:** Using the same Supabase project for integration tests since the test data is scoped to fixed test UUIDs and cleaned up after each run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added SET LOCAL ROLE authenticated to withSchool**
- **Found during:** Task 2.1 (RLS integration tests failing)
- **Issue:** The postgres user in Supabase has `bypassrls=true`, so even with `set_config(app.school_id, ...)`, RLS policies were skipped — `withSchool(A)` returned rows from both school A and B
- **Fix:** Added `SET LOCAL ROLE authenticated` as first statement in the transaction before `set_config`; the authenticated role has `bypassrls=false` so RLS policies apply
- **Files modified:** lib/db/client.ts
- **Verification:** Integration test withSchool(A) returns only A rows, withSchool(B) returns only B rows, cross-school query returns empty
- **Committed in:** 8ed2519

**2. [Rule 2 - Missing Critical] Added FORCE ROW LEVEL SECURITY migration**
- **Found during:** Task 2.1 (investigating RLS bypass)
- **Issue:** Without FORCE ROW LEVEL SECURITY, the postgres user (table owner) bypasses RLS entirely. Added migration to document intent and ensure correctness for non-bypassrls connections.
- **Fix:** Created db/migrations/0001_force_rls.sql with ALTER TABLE ... FORCE ROW LEVEL SECURITY for all 9 RLS tables
- **Files modified:** db/migrations/0001_force_rls.sql, db/migrations/meta/_journal.json
- **Verification:** `relforcerowsecurity=true` confirmed via pg_class query
- **Committed in:** 8ed2519

**3. [Rule 1 - Bug] Fixed dotenv loading order for standalone tsx scripts**
- **Found during:** Task 2.2 (pnpm seed failing with missing env vars)
- **Issue:** `import "dotenv/config"` in lib/db/client.ts loads from `.env` (not `.env.local`). Due to CJS import hoisting, supabase-admin.ts is evaluated before any dotenv config call, causing "Missing NEXT_PUBLIC_SUPABASE_URL" error
- **Fix:** Added `config({ path: ".env.local", override: false }); config()` to both lib/db/client.ts and lib/db/supabase-admin.ts; also added to test/integration/setup.ts
- **Files modified:** lib/db/client.ts, lib/db/supabase-admin.ts, test/integration/setup.ts
- **Verification:** pnpm seed exits 0; integration tests pass
- **Committed in:** a3e6468

**4. [Rule 1 - Bug] Fixed seed.ts to use withSchool for school-scoped inserts**
- **Found during:** Task 2.2 (seed would fail with FORCE ROW LEVEL SECURITY active)
- **Issue:** Plan's seed template used direct `db.insert()` for school-scoped tables. With FORCE RLS + SET LOCAL ROLE, postgres user is subject to RLS inside withSchool, but direct inserts bypass this. Without withSchool, direct inserts succeed (postgres bypassrls), but conceptually should use the RLS wrapper.
- **Fix:** Wrapped all school-scoped inserts (academic_years, staff_users, editor_scopes, event_types) in `withSchool(school.id, ...)`. Schools table (no RLS) inserted directly.
- **Files modified:** db/seed.ts
- **Verification:** pnpm seed exits 0 twice; seed.test.ts passes
- **Committed in:** a3e6468

**5. [Rule 1 - Bug] Fixed integration test cleanup order (FK violation)**
- **Found during:** Task 2.1 (afterAll failing with FK constraint error)
- **Issue:** `DELETE FROM schools WHERE id IN (...)` failed because event_types has FK to schools without ON DELETE CASCADE
- **Fix:** Added explicit `DELETE FROM event_types WHERE school_id IN (...)` before deleting schools in afterAll
- **Files modified:** test/integration/setup.ts
- **Verification:** afterAll runs cleanly; no dangling rows
- **Committed in:** 8ed2519

---

**Total deviations:** 5 auto-fixed (2 missing critical, 3 bugs)
**Impact on plan:** All auto-fixes necessary for RLS correctness and test stability. Core withSchool contract unchanged — just needed additional SET ROLE step to enforce RLS against postgres bypassrls user.

## Issues Encountered

- Vitest `beforeAll` timeout (default 10s) was too short for seed script that calls `supabaseAdmin.auth.admin.createUser` 8 times over the network. Fixed with explicit 60000ms timeout.
- dotenvx v17 intercepts `import "dotenv/config"` and loads only from `.env` (not `.env.local`). This affected all tsx scripts. Fixed by using `config({ path: ".env.local" })` explicitly.

## Migration Status

- **0000_initial.sql**: Applied — 10 tables, 9 with RLS enabled, 9 with school_isolation policy
- **0001_force_rls.sql**: Applied — 9 tables with FORCE ROW LEVEL SECURITY

## Test Results

- `pnpm test:integration -- rls`: 3/3 passing (DB-02, DB-03, DB-05 at DB layer)
- `pnpm test:integration -- seed`: 6/6 passing (DB-06)
- Total integration tests: 9 passing, 8 todo (auth tests — Plan 04)

## Seed Credentials (dev only)

- Admin: `admin@demo-school.test` / `ChangeMe123!`
- Grade 7–12 editors: `grade{N}@demo-school.test` / `ChangeMe123!`
- Counselor: `counselor@demo-school.test` / `ChangeMe123!`

## Known Stubs

None — all seed data is wired to real DB; test fixtures use real Supabase project.

## Next Phase Readiness

- withSchool is ready for consumption by Plans 03 (auth routes) and 04 (session helpers)
- Seed credentials documented for Plan 03 login endpoint testing
- Integration test infrastructure (setup.ts) ready for auth tests in Plan 04
- TEST_DATABASE_URL set to same Supabase project (Plan 04 may need separate test DB for lockout tests)

---
*Phase: 01-database-rls-auth*
*Completed: 2026-05-10*
