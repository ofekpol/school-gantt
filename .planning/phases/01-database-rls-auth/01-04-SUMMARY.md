---
phase: 01-database-rls-auth
plan: 04
subsystem: auth-routes
tags: [auth, login, logout, reset-password, lockout, zod, supabase, vitest]
dependency_graph:
  requires: [01-03]
  provides: [AUTH-01, AUTH-02, AUTH-03]
  affects: [middleware, staff-dashboard, admin-queue]
tech_stack:
  added: []
  patterns:
    - "DB-backed login lockout: loginAttempts + lockedUntil columns incremented on failure, reset on success"
    - "vi.mock for next/headers + createSupabaseServerClient in integration tests — isolates auth transport from DB logic"
    - "Enumeration defense: reset-password route returns 200 regardless of email existence"
key_files:
  created:
    - lib/validations/auth.ts
    - app/api/v1/auth/login/route.ts
    - app/api/v1/auth/logout/route.ts
    - app/api/v1/auth/reset-password/route.ts
  modified:
    - test/integration/auth.test.ts
decisions:
  - "vi.mock for @/lib/supabase/server in integration tests — isolates Supabase auth transport from real DB; DB counter updates still hit test Postgres; next/headers mocked to allow route handler import in Node env"
  - "RESEND_API_KEY=placeholder — reset-password route implemented fully; email delivery deferred until Resend SMTP relay configured in Supabase dashboard (Task 4.3 auto-approved)"
metrics:
  duration: 11 min
  completed_date: "2026-05-10"
  tasks: 3
  files: 5
---

# Phase 01 Plan 04: Auth Routes — Login, Logout, Reset-Password Summary

Three Next.js route handlers implementing login with 10-attempt DB-backed lockout (AUTH-01 + AUTH-03), logout session clearing, and password-reset via Supabase Auth resetPasswordForEmail (AUTH-02 code path, email delivery via Resend SMTP relay).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 4.1 | Login + logout routes with DB-backed lockout | b354832 | lib/validations/auth.ts, app/api/v1/auth/login/route.ts, app/api/v1/auth/logout/route.ts, test/integration/auth.test.ts |
| 4.2 | Password-reset route handler | db4e0fa | app/api/v1/auth/reset-password/route.ts |
| 4.3 | Resend SMTP relay checkpoint | (auto-approved) | (no files — dashboard config only) |

## Route Behaviors

### POST /api/v1/auth/login

- Validates body with `LoginSchema` (Zod): `{ email: string, password: string }`
- Looks up `staff_users` by email (service-role client, bypasses RLS — school unknown at login time)
- Returns generic 401 for unknown email (no existence leak)
- Checks `lockedUntil`: if in the future, returns **423 Locked** immediately (lockout takes precedence even with correct password)
- Calls `supabase.auth.signInWithPassword` via `createSupabaseServerClient` (SSR client sets session cookies on response)
- On auth failure: increments `loginAttempts`; if `>= MAX_ATTEMPTS (10)`, sets `lockedUntil = NOW + 15 minutes`; returns 401
- On auth success: resets `loginAttempts = 0`, clears `lockedUntil`; returns 200 + `{ user: { id, email, role, schoolId } }`
- Invalid body shape: returns 400

### POST /api/v1/auth/logout

- Calls `supabase.auth.signOut()` (clears session cookies)
- Returns 200 + `{ ok: true }`

### POST /api/v1/auth/reset-password

- Validates body with `ResetPasswordSchema` (Zod): `{ email: string }`
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })` where `redirectTo = NEXT_PUBLIC_APP_URL/login/reset`
- Returns 200 + `{ ok: true }` regardless of whether email exists (enumeration defense)
- Email is dispatched by Supabase using the SMTP provider (Resend relay — requires dashboard config)

## Integration Test Results (AUTH-01 + AUTH-03)

**Test file:** `test/integration/auth.test.ts`
**Run:** `pnpm vitest run --project integration test/integration/auth.test.ts`
**Result:** 7 tests passing

| Test | Status |
|------|--------|
| AUTH-01: valid credentials return 200 + user payload | PASS |
| AUTH-01: wrong password returns 401 | PASS |
| AUTH-01: unknown email returns 401 (no leak) | PASS |
| AUTH-01: invalid input shape returns 400 | PASS |
| AUTH-03: 10 failed attempts set locked_until in the future | PASS |
| AUTH-03: 11th attempt with CORRECT password returns 423 Locked | PASS |
| AUTH-03: successful login resets login_attempts to 0 | PASS |

**Testing approach:** Route handlers imported directly in Node test environment. `next/headers` and `@/lib/supabase/server` mocked via `vi.mock`. DB operations (loginAttempts counter, lockedUntil) run against real test Postgres (`TEST_DATABASE_URL`). Tests skip gracefully if `TEST_DATABASE_URL` is unset.

## AUTH-02 Verification: SMTP Relay Status

**Task 4.3 checkpoint: AUTO-APPROVED** — `RESEND_API_KEY=placeholder` per execution context.

- Reset-password route is fully implemented and type-safe
- `pnpm build` verifies the route compiles correctly (`/api/v1/auth/reset-password` appears in build output)
- Email delivery will not work until Resend SMTP credentials are configured in the Supabase Auth dashboard
- **Deferred to Phase 8** (deliverability hardening): configure Resend as Supabase Auth SMTP provider; add SPF/DKIM/DMARC for Hebrew domain

## Wave-Level Verification

| Check | Result |
|-------|--------|
| `pnpm tsc --noEmit` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS — all 3 auth routes compiled as dynamic handlers |
| `pnpm test:integration auth` | 7/7 PASS |

## Phase 1 Closeout Snapshot

All Phase 1 plans (01-00 through 01-04) are now complete:

| Plan | Description | Status |
|------|-------------|--------|
| 01-00 | Schema + migration (staffUsers, loginAttempts, lockedUntil) | Complete |
| 01-01 | Database client wrapper (withSchool RLS) | Complete |
| 01-02 | RLS policies + seed | Complete |
| 01-03 | Auth helpers, middleware, public route group | Complete |
| 01-04 | Auth routes: login, logout, reset-password | Complete |

**Requirements addressed:** AUTH-01, AUTH-02, AUTH-03, DB-01 through DB-06 (from prior plans).

## Deviations from Plan

### Auto-approved Task 4.3 (Resend SMTP checkpoint)

- **Rule applied:** Execution context override — `RESEND_API_KEY=placeholder`
- **Action:** Checkpoint auto-approved; email delivery noted as deferred
- **Impact:** AUTH-02 manual verification cannot be completed in this environment

### Integration test vi.mock approach (not in plan spec)

- **Rule 1 — Fix:** The plan's test spec passed `makeReq()` returning plain `Request` to `loginPOST(NextRequest)`, which TypeScript rejected. Also, the plan's `execSync("pnpm seed")` in `beforeAll` was removed — the test DB already has the seed data (TEST_DATABASE_URL connects to the live Supabase project via Plan 01-02). The `vi.mock` pattern was used to avoid `next/headers` crashes in Node test env.
- **Files modified:** `test/integration/auth.test.ts`
- **Commit:** b354832

## Deferred Items

- Hebrew password-reset email deliverability (SPF/DKIM/DMARC) — Phase 8
- Resend SMTP relay configuration in Supabase dashboard — Phase 8
- `/login/reset` UI handler (receives reset token from Supabase) — Phase 2

## Self-Check: PASSED

Files exist:
- FOUND: lib/validations/auth.ts
- FOUND: app/api/v1/auth/login/route.ts
- FOUND: app/api/v1/auth/logout/route.ts
- FOUND: app/api/v1/auth/reset-password/route.ts
- FOUND: test/integration/auth.test.ts

Commits exist:
- b354832: feat(01-04): implement login + logout routes with DB-backed lockout (AUTH-01 + AUTH-03)
- db4e0fa: feat(01-04): implement password-reset route handler (AUTH-02 code path)
