---
phase: 01-database-rls-auth
plan: 03
subsystem: auth
tags: [supabase, next-intl, middleware, jwt, rls, server-components, vitest]

# Dependency graph
requires:
  - phase: 01-02
    provides: withSchool wrapper, Drizzle schema (staffUsers, editorScopes), service-role client

provides:
  - lib/supabase/server.ts — createSupabaseServerClient factory (next/headers cookies adapter)
  - lib/supabase/browser.ts — createSupabaseBrowserClient for use-client components
  - lib/db/staff.ts — getStaffUserByAuthId cross-school staff lookup (stays in lib/db/ per ESLint rule)
  - lib/auth/session.ts — getSession (uses getUser, not getSession — Pitfall 2 guard) + getStaffUser
  - lib/auth/scopes.ts — assertEditorScope throws Response(403) on scope violation; admins bypass
  - middleware.ts — single composed pipeline (next-intl i18n + Supabase session refresh)
  - app/(public)/layout.tsx — public route group with no session check (AUTH-07)

affects:
  - 01-04 (login route will import createSupabaseBrowserClient + getSession)
  - all later phases that check session or assert scopes
  - any route that needs to know user identity

# Tech tracking
tech-stack:
  added:
    - next-intl@3.26.5 (i18n middleware + message routing)
    - server-only@0.0.1 (compile-time guard against importing server modules in client components)
  patterns:
    - Pitfall 2 guard: always use auth.getUser() never auth.getSession() in server code
    - ESLint boundary: service-role queries stay in lib/db/ — lib/auth/ uses lib/db/staff.ts
    - server-only mocked with no-op in vitest unit test alias (avoids jsdom crash)
    - middleware pipeline: i18n first → if redirect, short-circuit; else Supabase refresh

key-files:
  created:
    - lib/supabase/server.ts
    - lib/supabase/browser.ts
    - lib/db/staff.ts
    - lib/auth/session.ts
    - lib/auth/scopes.ts
    - middleware.ts
    - app/(public)/layout.tsx
    - app/(public)/page.tsx (moved from app/page.tsx)
    - messages/he.json
    - messages/en.json
    - test/__mocks__/server-only.ts
    - test/unit/auth/session.test.ts (replaced it.todo stubs)
    - test/unit/auth/scopes.test.ts (replaced it.todo stubs)
    - test/integration/public-routes.test.ts (replaced it.todo stubs)
  modified:
    - vitest.config.ts (added server-only alias for unit test project)
    - package.json (added next-intl, server-only)

key-decisions:
  - "getSession() uses auth.getUser() not auth.getSession() — Pitfall 2: getSession() reads cookie locally without JWT validation"
  - "Cross-school staff lookup lives in lib/db/staff.ts (not lib/auth/) — preserves ESLint ban on service-role client outside lib/db/"
  - "server-only mocked as no-op in vitest unit tests via vitest.config.ts alias — server-only throws in jsdom, real guard active in Next.js runtime"
  - "Middleware short-circuits on i18n redirect (status 300-399) before Supabase refresh — avoids cookie mutation on redirects"
  - "app/(public)/layout.tsx has zero session checks — auth guard lives in (staff) and (admin) route group layouts (future plans)"

patterns-established:
  - "Auth boundary: lib/auth/ imports lib/db/staff.ts for DB lookups — never imports supabaseAdmin directly"
  - "TDD: write tests against it.todo stubs first (RED), then implement (GREEN)"
  - "Public routes: no auth check in layout — protected routes add auth in their own layout"

requirements-completed:
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-07

# Metrics
duration: 17min
completed: 2026-05-10
---

# Phase 01 Plan 03: Auth Helpers + Middleware Summary

**Supabase server/browser client factories, getSession (getUser-based), assertEditorScope with admin bypass, and composed next-intl + Supabase middleware protecting public routes without redirect**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-10T18:28:43Z
- **Completed:** 2026-05-10T18:45:48Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Auth infrastructure consumed by all future phases: `getSession()`, `getStaffUser()`, `assertEditorScope()`
- Security Pitfall 2 guard baked into `lib/auth/session.ts`: uses `auth.getUser()` (server-side JWT validation) never `auth.getSession()` (local cookie read only)
- CLAUDE.md service-role boundary maintained: `lib/auth/session.ts` delegates staff lookup to `lib/db/staff.ts` so `supabaseAdmin` never leaks into `lib/auth/`
- Unified middleware composed: next-intl i18n routing first, then Supabase session refresh — public routes pass through without redirect (AUTH-07)
- 10 AUTH-04 unit tests, 6 AUTH-05/06 unit tests, 3 AUTH-07 integration tests — all passing

## Task Commits

1. **Task 3.1: Supabase client factories + getSession + getStaffUser** - `9e70d7c` (feat)
2. **Task 3.2: assertEditorScope + AUTH-05/06 unit tests** - `4832c00` (feat)
3. **Task 3.3: Composed middleware + public route group + AUTH-07 integration tests** - `05559c9` (feat)

## Files Created/Modified

- `lib/supabase/server.ts` — createSupabaseServerClient factory using next/headers cookies()
- `lib/supabase/browser.ts` — createSupabaseBrowserClient for use-client components (Plan 04 login form)
- `lib/db/staff.ts` — getStaffUserByAuthId cross-school PK lookup; lives in lib/db/ per ESLint rule
- `lib/auth/session.ts` — getSession uses getUser(); getStaffUser delegates to lib/db/staff.ts
- `lib/auth/scopes.ts` — assertEditorScope: admins bypass, editors checked via withSchool RLS query
- `middleware.ts` — i18n-first + Supabase refresh pipeline; matcher excludes api/v1/auth/*
- `app/(public)/layout.tsx` — public group root layout with no session check
- `app/(public)/page.tsx` — Hebrew RTL placeholder (moved from app/page.tsx)
- `messages/he.json` + `messages/en.json` — next-intl message stubs
- `test/__mocks__/server-only.ts` — no-op mock for jsdom unit test environment
- `test/unit/auth/session.test.ts` — 10 tests replacing it.todo stubs
- `test/unit/auth/scopes.test.ts` — 6 tests replacing it.todo stubs
- `test/integration/public-routes.test.ts` — 3 tests replacing it.todo stubs
- `vitest.config.ts` — added server-only alias in unit test project

## Decisions Made

- Used `auth.getUser()` not `auth.getSession()` — Pitfall 2 from research: `getSession()` only reads the local cookie without server validation
- Cross-school staff lookup placed in `lib/db/staff.ts` not `lib/auth/session.ts` — preserves CLAUDE.md ESLint rule (no service-role client outside lib/db/)
- Added `server-only` as a no-op mock in vitest unit test alias — the package throws in jsdom; the real guard remains active in Next.js production runtime
- Middleware short-circuits on i18n redirects (3xx) before running Supabase — avoids cookie mutation during locale redirects

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added server-only mock for vitest unit test environment**
- **Found during:** Task 3.1 (session tests)
- **Issue:** `server-only` package throws `"This module cannot be imported from a Client Component module"` in jsdom environment, causing all unit tests for session.ts to crash
- **Fix:** Created `test/__mocks__/server-only.ts` (empty no-op export) and added `alias: { "server-only": "..." }` to the unit test project in `vitest.config.ts`
- **Files modified:** `vitest.config.ts`, `test/__mocks__/server-only.ts`
- **Verification:** All 10 session tests pass; real server-only guard still enforced in Next.js runtime
- **Committed in:** `9e70d7c` (Task 3.1 commit)

**2. [Rule 1 - Bug] Removed supabaseAdmin from session.ts comment to pass static test**
- **Found during:** Task 3.1 (session tests)
- **Issue:** Comment in `lib/auth/session.ts` mentioned the word `supabaseAdmin` in an explanatory note; the test regex `/supabaseAdmin/` matched the comment and failed the "does NOT import supabaseAdmin" test
- **Fix:** Rephrased comment to say "the service-role client" instead of naming `supabaseAdmin` explicitly
- **Files modified:** `lib/auth/session.ts`
- **Verification:** Static test passes; intent of comment preserved
- **Committed in:** `9e70d7c` (Task 3.1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered

- Stale `.next/types/app/page.ts` cached types after moving `app/page.tsx` to `app/(public)/page.tsx` caused TypeScript errors; resolved by deleting `.next/` before final `pnpm tsc --noEmit`

## Known Stubs

- `messages/he.json` + `messages/en.json` contain only a `_placeholder` key — populated as features are built in later phases

## Next Phase Readiness

- **AUTH-04, AUTH-05, AUTH-06, AUTH-07** requirements all satisfied
- **Plan 04** can now import `createSupabaseBrowserClient` for the login form and `getSession` for the protected layout redirect
- **assertEditorScope** is ready to be called from any API route that needs grade/event_type scope enforcement
- Middleware is in place — Plan 04's `/api/v1/auth/*` route is excluded from middleware (matcher pattern confirmed)

---

*Phase: 01-database-rls-auth*
*Completed: 2026-05-10*
