---
phase: 01-database-rls-auth
plan: "00"
subsystem: testing
tags: [vitest, integration-tests, rls, auth, postgres, drizzle, tsx]

# Dependency graph
requires: []
provides:
  - Vitest dual-project config (unit/jsdom + integration/node)
  - Integration test pool + transaction setup (skip-if-no-db guard)
  - Failing test stubs for DB-02, DB-03, DB-05, DB-06, AUTH-01, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
  - .env.example with all 7 required env var keys documented
  - tsx devDependency for seed script execution
  - test:unit, test:integration, seed, db:generate, db:migrate npm scripts
affects:
  - 01-01 (DB schema — integration tests run against it)
  - 01-02 (RLS policies — rls.test.ts stubs cover them)
  - 01-03 (Auth — auth/session/scopes test stubs cover them)
  - 01-04 (Seed — seed.test.ts stubs validate it)

# Tech tracking
tech-stack:
  added:
    - tsx@^4.20.0 (devDep — run db/seed.ts without compilation step)
    - drizzle-orm/node-postgres (drizzle client for test pool)
    - dotenv (loaded in integration setup)
  patterns:
    - Integration test setup with skip-if-no-env guard (TEST_DATABASE_URL optional)
    - Vitest projects array separating jsdom (unit) from node (integration)
    - it.todo() stubs to establish coverage map before implementation

key-files:
  created:
    - test/integration/setup.ts
    - test/integration/rls.test.ts
    - test/integration/auth.test.ts
    - test/integration/seed.test.ts
    - test/integration/public-routes.test.ts
    - test/unit/auth/session.test.ts
    - test/unit/auth/scopes.test.ts
    - .env.example
  modified:
    - vitest.config.ts (single jsdom → projects array with unit + integration)
    - package.json (scripts + tsx devDep)

key-decisions:
  - "Vitest projects array chosen over separate config files — single config, two named project contexts"
  - "it.todo() chosen over expect(true).toBe(false) — pending tests in coverage map, no false failures blocking CI"
  - "skipIfNoTestDb guard in setup.ts — integration tests skip gracefully when TEST_DATABASE_URL absent (Option C for now)"
  - "TEST_DATABASE_URL left empty by default — Plan 04 AUTH-03 lockout tests will require it; flagged as future requirement"

patterns-established:
  - "Integration test pool: Pool from pg + drizzle({ client: testPool }) with afterAll cleanup"
  - "Environment guard pattern: export skipIfNoTestDb = !process.env.TEST_DATABASE_URL"

requirements-completed:
  - DB-01
  - DB-02
  - DB-03
  - DB-05
  - DB-06
  - AUTH-01
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-07

# Metrics
duration: 3min
completed: 2026-05-09
---

# Phase 01 Plan 00: Test Scaffolding Summary

**Vitest dual-project config (unit/jsdom + integration/node) with failing stubs covering all Phase 1 requirements and .env.example documenting 7 required Supabase/Resend keys**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-09T14:46:00Z
- **Completed:** 2026-05-09T14:49:11Z
- **Tasks:** 3 of 3 completed
- **Files modified:** 10 (+ .env.local created by user)

## Accomplishments
- Replaced single jsdom Vitest config with projects array (unit: jsdom, integration: node)
- Created 7 test stub files covering all Phase 1 requirements (DB-02, DB-03, DB-05, DB-06, AUTH-01, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07)
- Created integration test setup with Pool + drizzle client and skip-if-no-env guard
- Documented all 7 required environment variables in .env.example
- Added tsx devDep and convenience scripts (test:unit, test:integration, seed, db:generate, db:migrate)

## Task Commits

1. **Task 0.1: vitest.config.ts dual-project + tsx devDep** - `746d3d3` (chore)
2. **Task 0.2: Integration test setup + failing stubs** - `ba4195f` (test)
3. **Task 0.3: Credential checkpoint** — COMPLETE (human action: .env.local created with all required keys)

## Files Created/Modified
- `vitest.config.ts` - Replaced single jsdom config with projects array (unit + integration)
- `package.json` - Added scripts + tsx devDep (merged with parallel-agent additions: drizzle-orm, pg, supabase, etc.)
- `test/integration/setup.ts` - Pool + drizzle test client, skipIfNoTestDb guard
- `test/integration/rls.test.ts` - it.todo stubs for DB-02, DB-03, DB-05
- `test/integration/auth.test.ts` - it.todo stubs for AUTH-01, AUTH-03
- `test/integration/seed.test.ts` - it.todo stubs for DB-06
- `test/integration/public-routes.test.ts` - it.todo stubs for AUTH-07
- `test/unit/auth/session.test.ts` - it.todo stubs for AUTH-04
- `test/unit/auth/scopes.test.ts` - it.todo stubs for AUTH-05, AUTH-06
- `.env.example` - 7 required env var keys with documentation (expanded from parallel agent's minimal version)

## Decisions Made
- Used `it.todo()` instead of `expect(true).toBe(false)` — pending tests appear in the coverage map without causing CI failures during Wave 0
- `skipIfNoTestDb` guard: integration tests silently skip when `TEST_DATABASE_URL` is absent — prevents credential-less CI failures
- TEST_DATABASE_URL left empty (Option C from plan) — Plan 04 AUTH-03 lockout tests will require it; noted as future requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Parallel Agent Conflict] Merged parallel-agent package.json changes**
- **Found during:** Task 0.2 (parallel agents modified package.json concurrently)
- **Issue:** Two parallel agents added dependencies (supabase, drizzle-orm, pg, dotenv, resend, drizzle-kit, @types/pg) and reset scripts section, removing the scripts and tsx devDep added in Task 0.1
- **Fix:** Re-applied missing scripts (test:unit, test:integration, seed, db:generate, db:migrate) and tsx devDep while preserving all parallel-agent additions
- **Files modified:** package.json
- **Verification:** node -e check confirms all scripts and tsx present
- **Committed in:** ba4195f (Task 0.2 commit)

---

**Total deviations:** 1 auto-fixed (parallel execution conflict)
**Impact on plan:** No scope change. All planned scripts and deps present. Parallel-agent deps (drizzle-orm, pg, supabase, etc.) are required by later plans — no regression.

## Issues Encountered
- Parallel agents running concurrently modified package.json multiple times, resetting scripts. Fixed by re-applying additions on each iteration until committed atomically.

## User Setup Completed

**Task 0.3 (human-action checkpoint) is complete.** The user created `.env.local` with:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (secret)
- `DATABASE_URL` — direct Postgres connection for Drizzle
- `RESEND_API_KEY` — placeholder value (email delivery not yet needed)
- `NEXT_PUBLIC_APP_URL` — app base URL

**TEST_DATABASE_URL:** Left empty (Option C) — integration tests will skip gracefully until Plan 04 AUTH-03 lockout tests require it.

## Next Phase Readiness
- Wave 0 scaffolding complete — test stubs exist for every requirement
- Wave 1 plans (01-01 through 01-04) can proceed — credentials are in place
- TEST_DATABASE_URL blocker for Plan 04 AUTH-03 lockout tests — must be resolved before that plan executes

---
*Phase: 01-database-rls-auth*
*Completed: 2026-05-09*

## Self-Check: PASSED

Files verified:
- FOUND: test/integration/setup.ts
- FOUND: test/integration/rls.test.ts
- FOUND: test/integration/auth.test.ts
- FOUND: test/integration/seed.test.ts
- FOUND: test/integration/public-routes.test.ts
- FOUND: test/unit/auth/session.test.ts
- FOUND: test/unit/auth/scopes.test.ts
- FOUND: .env.example
- FOUND: vitest.config.ts (contains projects: array)
- FOUND: package.json (contains test:integration script and tsx devDep)

Commits verified:
- FOUND: 746d3d3 (chore: vitest + tsx)
- FOUND: ba4195f (test: integration stubs)
