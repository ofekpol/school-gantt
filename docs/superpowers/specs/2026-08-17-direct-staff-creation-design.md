# Direct Staff Creation (Admin-Added Users) — Design Spec

**Date:** 2026-08-17
**Status:** Approved
**Scope:** Let an admin add a staff user directly by email + role/scopes, issuing a random one-time temporary password, forcing a password change on first login. Adds alongside the existing invite-link flow; does not replace it.

---

## Context

Staff accounts today are created two ways: (1) an admin creates an invite link, the invitee registers and picks their own password, or (2) a user self-registers via email/password and an admin later approves + assigns a school (`pending_registrations`). There is no way for an admin to create an already-active account directly.

This exact feature existed previously — `createStaffUser` with a `temporaryPassword` field, wired to `POST /api/v1/admin/staff` — and was intentionally disabled in commit `b53ae20` in favor of the invite-link flow (`POST /api/v1/admin/staff` currently returns a hardcoded `405 direct_staff_creation_removed`). Most of the supporting plumbing is still live and unused for this purpose:

- `staff_users.must_change_password` column
- Forced redirect to `/auth/change-password` in `(staff)/layout.tsx` and `(admin)/layout.tsx` when `mustChangePassword` is true
- `POST /api/v1/auth/change-password` (enforces 8-char/uppercase/digit policy, clears the flag)
- `StaffUserCreateSchema` Zod schema (email, fullName, role, gradeScopes?, eventTypeScopes?) — already has no `temporaryPassword` field, since the password is meant to be server-generated
- i18n keys `admin.staff.create` and `admin.staff.duplicateEmail` — present in `messages/he.json`, currently unused

This spec revives and rewires that plumbing rather than inventing a new mechanism.

**Security correction from the original request:** a single fixed password (e.g. `12345678`) shared across every new account would leave a window, between account creation and the real user's first login, where anyone who knows the scheme could sign in as them. Instead each temp password is randomly generated per user, shown once to the admin, and never reused.

---

## Flow

```
[Admin: /admin/staff page → AddStaffForm]
  ↓ submit { email, fullName, role, gradeScopes?, eventTypeScopes? }
[POST /api/v1/admin/staff]
  → assertAdmin guard (401/403)
  → Zod validation (StaffUserCreateSchema)
  → generateTempPassword()  — random, not fixed
  → supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })
  → createStaffUserDirect(): insert staff_users (status: 'active', mustChangePassword: true)
                              + editor_scopes rows, inside withSchool(schoolId, ...)
  → on staff_users insert failure after auth user created: supabaseAdmin.auth.admin.deleteUser() (rollback)
  → 201 { id, email, temporaryPassword }
[AddStaffForm] shows one-time panel: email + temp password + copy button
  (admin relays these to the new user out of band; nothing emailed, nothing persisted client-side)

[New user: /auth/login]
  ↓ submit { email, temporaryPassword }
[POST /api/v1/auth/signin]  (existing, unchanged)
  → supabase.auth.signInWithPassword(...)
  → session established

[(staff)/layout.tsx or (admin)/layout.tsx]  (existing, unchanged)
  → mustChangePassword === true → redirect /auth/change-password
[POST /api/v1/auth/change-password]  (existing, unchanged)
  → validates new password (8+ chars, uppercase, digit)
  → supabase.auth.updateUser({ password })
  → staff_users.mustChangePassword = false
  → user proceeds to /dashboard or /admin
```

No changes to the invite-link flow, the OAuth pending-approval flow, or the login/change-password gating logic — all of that is reused as-is.

---

## Data Model

No schema changes. Existing `staff_users` columns cover this:

| Column | Value at direct creation |
|--------|---------------------------|
| `id` | new `auth.users.id` (UUID) from `createUser`|
| `schoolId` | admin's `schoolId` (from session) |
| `email` | from form |
| `fullName` | from form |
| `role` | from form (`editor` \| `admin` \| `viewer`) |
| `status` | `'active'` |
| `mustChangePassword` | `true` (the point of this flow) |
| `loginAttempts` / `lockedUntil` | schema defaults |

`editor_scopes` rows inserted only when `role === 'editor'`, same rule `updateStaffUser` already uses.

---

## New / Modified Files

| File | Change |
|------|--------|
| `lib/db/staff.ts` | Add `createStaffUserDirect(params)` — creates Supabase auth user, inserts `staff_users` + `editor_scopes` inside `withSchool`, rolls back the auth user on DB failure |
| `lib/auth/password.ts` (new) | Add `generateTempPassword()` — random password, unambiguous charset (excludes `0/O/1/l/I`), guarantees ≥1 upper/lower/digit |
| `app/api/v1/admin/staff/route.ts` | Replace the `405` stub in `POST` with the real handler described above |
| `components/admin/AddStaffForm.tsx` (new) | Client form mirroring `InviteForm.tsx`: email + fullName + role + `ScopeFields`, POSTs to `/api/v1/admin/staff`, shows one-time reveal panel on success |
| `app/(admin)/admin/staff/page.tsx` | Render `AddStaffForm` in a new section alongside the existing Invites section |
| `messages/he.json` / `messages/en.json` | Add keys for the reveal panel (temp password label, one-time warning, copy button); reuse existing `create` / `duplicateEmail` / `createError` keys for the form itself |

---

## Existing Reuse

- `assertAdmin` (`lib/auth/admin.ts`) — same guard pattern as every other `/admin/*` route
- `withSchool` — same tenant isolation pattern as `createStaffUserFromInvite` / `updateStaffUser`
- `ScopeFields` component — same grade/event-type picker UI as `InviteForm`
- `StaffUserCreateSchema` (`lib/validations/admin.ts`) — already shaped correctly, no changes needed
- `mustChangePassword` gate in both staff/admin layouts and `POST /api/v1/auth/change-password` — fully reused, unmodified
- i18n keys `admin.staff.create`, `admin.staff.duplicateEmail`, `admin.staff.createError` — already present, unused until now

---

## API Contract

### `POST /api/v1/admin/staff`

Request:
```json
{
  "email": "string (email)",
  "fullName": "string (1-255 chars)",
  "role": "editor | admin | viewer",
  "gradeScopes": [7, 8],
  "eventTypeScopes": ["exam", "trip"]
}
```

Responses:
- `201` `{ "id": "uuid", "email": "string", "temporaryPassword": "string" }`
- `401` `{ "error": "Unauthorized" }` — no session
- `403` `{ "error": "Forbidden" }` — not admin, inactive, or `mustChangePassword` true (admin must finish their own reset first, mirrors the invites POST route)
- `400` `{ "error": "Invalid input", "details": {...} }` — Zod failure
- `409` `{ "error": "duplicate_email" }` — email already exists in `staff_users` or Supabase auth

---

## Error States

| Scenario | Handling |
|----------|----------|
| Email already registered | `supabaseAdmin.auth.admin.createUser` rejects it before any DB write happens (primary path) → mapped to `409 duplicate_email`. The `staff_users.email` unique constraint is a backstop for the rare case where an auth user exists without a matching row — that case also rolls back via `deleteUser` per the row above |
| Auth user created, DB insert fails | `supabaseAdmin.auth.admin.deleteUser(id)` rollback, then `500` |
| Non-admin caller | `403` via `assertAdmin` |
| Admin has own `mustChangePassword` pending | `403`, same guard as invites POST |
| Invalid role/scopes | `400` via Zod |

---

## Test Plan

| Test | Type | Coverage |
|------|------|----------|
| `POST /admin/staff` — valid payload, role editor with scopes | Integration | `staff_users` row created, `mustChangePassword=true`, `editor_scopes` rows match |
| `POST /admin/staff` — role admin/viewer | Integration | No `editor_scopes` rows inserted |
| `POST /admin/staff` — duplicate email | Integration | `409 duplicate_email`, no orphaned auth user |
| `POST /admin/staff` — non-admin caller | Integration | `403` |
| `POST /admin/staff` — cross-school isolation | Integration (real Postgres) | Created row only visible under the admin's own `schoolId` via `withSchool` |
| `generateTempPassword()` | Unit | Correct length, charset, contains upper/lower/digit, no ambiguous chars, distinct across many calls |
| E2E: admin creates user → sees temp password once → new user signs in → forced to `/auth/change-password` → sets new password → reaches `/dashboard` | Playwright | Full happy path, extends `test/e2e/admin-staff.spec.ts` |

**Mocking:** `supabaseAdmin.auth.admin.createUser`/`deleteUser` stubbed in unit tests; real Postgres for integration/RLS tests; real Supabase dev instance for the Playwright E2E test.

---

## Out of Scope

- Emailing the temp password automatically (explicitly on-screen-only per requirements)
- Replacing or removing the invite-link flow
- Changing the OAuth pending-approval flow
- Admin-initiated password resets for existing users (separate feature)
