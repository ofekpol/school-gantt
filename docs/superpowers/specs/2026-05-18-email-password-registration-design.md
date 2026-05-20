# Email/Password Registration — Design Spec

**Date:** 2026-05-18  
**Status:** Approved  
**Scope:** Add email/password registration and sign-in alongside existing Google OAuth for staff users.

---

## Context

The system currently supports Google OAuth only for staff authentication. This feature adds email/password as a second auth method. Both providers share the same `staff_users` table and session model. New email registrants confirm their email via Supabase's built-in confirmation flow, then become active immediately (no admin approval step).

---

## Auth Flow

```
[/auth/register page]
  ↓  submit { email, fullName, password }
[POST /api/v1/auth/register]
  → Zod validation
  → supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
  → returns { status: 'confirmation_sent' }
[Register page] shows "Check your email" message

[User clicks confirmation link in email]
  ↓
[GET /auth/confirm?token_hash=…&type=signup]
  → supabase.auth.verifyOtp({ token_hash, type: 'signup' })
  → session established, authUser available
  → createStaffUserFromEmailSignup({ id: authUser.id, email, fullName, status: 'active' })
  → redirect /auth/login?confirmed=1

[/auth/login page]  (email+password tab + Google button)
  ↓  submit { email, password }
[POST /api/v1/auth/signin]
  → check loginAttempts / lockedUntil (existing schema fields)
  → supabase.auth.signInWithPassword({ email, password })
  → on success: reset loginAttempts → redirect /dashboard
  → on fail: increment loginAttempts, set lockedUntil if ≥10 → 401/423
```

---

## Data Model

No new tables. Existing `staff_users` columns cover all requirements:

| Column | Value at registration |
|--------|-----------------------|
| `id` | `auth.users.id` (UUID) |
| `email` | from form |
| `fullName` | from form |
| `role` | `'editor'` (schema default) |
| `status` | `'active'` (set explicitly at confirm time) |
| `schoolId` | `null` (admin assigns later) |
| `loginAttempts` | `0` (schema default) |
| `lockedUntil` | `null` |

`auth_provider` column not added — inferrable from Supabase `auth.users` metadata if needed.

---

## New Files

| File | Purpose |
|------|---------|
| `app/auth/register/page.tsx` | Register page (Server Component wrapper) |
| `app/auth/confirm/route.ts` | GET handler — verifies OTP, creates staff_users row |
| `app/api/v1/auth/register/route.ts` | POST — calls signUp, returns confirmation_sent |
| `app/api/v1/auth/signin/route.ts` | POST — signInWithPassword + lockout logic |
| `components/auth/RegisterForm.tsx` | Client form: email + fullName + password + confirm |
| `components/auth/EmailPasswordSignInForm.tsx` | Client form: email + password, handles lockout error |

---

## Modified Files

| File | Change |
|------|--------|
| `middleware.ts` | Add `/auth/confirm` and `/auth/register` to `PUBLIC_PATHS` |
| `app/auth/login/page.tsx` | Add email/password tab alongside Google button |
| `lib/db/staff.ts` | Add `createStaffUserFromEmailSignup()` function |

---

## Existing Reuse

- `lib/db/staff.ts` — `getStaffUserByAuthId()` reused in confirm route (same pattern as `app/auth/callback/route.ts`)
- `lib/db/schema.ts` — `staffUsers` table: `loginAttempts`, `lockedUntil` already present
- `lib/supabase/server.ts` — `createSupabaseServerClient()` reused in all new routes
- `lib/supabase/browser.ts` — browser client reused in `EmailPasswordSignInForm`
- Zod validation pattern from existing API routes

---

## API Contracts

### `POST /api/v1/auth/register`

Request:
```json
{ "email": "string", "fullName": "string", "password": "string (min 8 chars)" }
```
Responses:
- `200` `{ "status": "confirmation_sent" }`
- `409` `{ "error": "email_already_registered" }` — Supabase returns this if email exists
- `422` `{ "error": "validation_error", "details": [...] }` — Zod failure

### `POST /api/v1/auth/signin`

Request:
```json
{ "email": "string", "password": "string" }
```
Responses:
- `200` `{ "status": "ok", "redirectTo": "/dashboard" }`
- `401` `{ "error": "invalid_credentials", "attemptsRemaining": N }`
- `423` `{ "error": "account_locked", "lockedUntil": "ISO8601" }`

### `GET /auth/confirm?token_hash=…&type=signup`

- Success → `staff_users` row created → redirect `/auth/login?confirmed=1`
- Failure → redirect `/auth/login?error=invalid_token`

---

## Error States

| Scenario | Handling |
|----------|----------|
| Email already exists | 409 from register route; UI shows "email taken" |
| Weak password | Zod min-length; Supabase also enforces min 6 chars |
| Confirmation link expired | Supabase token TTL (default 24h); redirect to login with error param |
| Account locked | `lockedUntil > now()` check before `signInWithPassword`; 15-min window |
| Staff user row already exists at confirm | `getStaffUserByAuthId()` check in confirm route; skip insert if row exists |

---

## Test Plan

| Test | Type | Coverage |
|------|------|----------|
| `POST /register` — valid payload | Integration | signUp called, returns `{ status: 'confirmation_sent' }` |
| `POST /register` — duplicate email | Integration | 409 returned |
| `POST /register` — invalid payload | Unit | Zod 422 |
| `GET /auth/confirm` — valid token | Integration | staff_users row inserted, status='active', redirect to login |
| `GET /auth/confirm` — invalid token | Integration | Redirect to login with error param |
| `GET /auth/confirm` — row already exists | Integration | Idempotent — no duplicate insert |
| `POST /signin` — correct credentials | Integration | Session established, loginAttempts reset |
| `POST /signin` — wrong password | Integration | 401, loginAttempts incremented |
| `POST /signin` — account locked | Integration | 423, lockedUntil returned |
| RLS: confirmed user cross-tenant denial | Integration (real Postgres) | withSchool isolation |
| E2E: register → confirm → sign in | Playwright | Full happy path |

**Mocking:** Supabase Auth methods (`signUp`, `signInWithPassword`, `verifyOtp`) stubbed in Vitest unit/integration tests. Real Postgres for RLS tests. Real Supabase dev instance for Playwright E2E.

---

## Out of Scope

- Password reset / forgot password flow (future)
- Admin UI for assigning `schoolId` to email-registered staff (existing admin panel covers this)
- Email HTML template customization (uses Supabase Dashboard template)
- Removing or deprecating Google OAuth
