# Plan: Google OAuth + Viewer Role + Admin Approval Flow

## Context

Replace the existing email+password auth system with Google OAuth only. Add a `viewer` role (authenticated read-only). Require authentication for ALL routes (no public access). Implement an admin-approval onboarding flow for new users (pending requests list in admin panel) and a pre-configured invite link system (role+scopes baked in, single-use).

---

## Decisions

- Google OAuth only — no fallback email+password
- All routes require auth (viewer layout replaces public layout)
- New users without invite → `pending_registrations` table → admin approves in `/admin/staff`
- Invite links → pre-configured with role+scopes, single-use, applied at OAuth callback
- Viewer role → can see Gantt/calendar/agenda + viewer dashboard; cannot create events
- Admin approval → panel only (no email to admin); email notification sent to user on approval
- `staff_users.school_id` → nullable for pending users
- Old lockout columns (`lockedUntil`, `loginAttempts`) → kept in DB, stop using in code

---

## Files to Delete

| File | Reason |
|------|--------|
| `app/api/v1/auth/login/route.ts` | Email+password login removed |
| `app/api/v1/auth/reset-password/route.ts` | Password reset removed |
| `lib/validations/auth.ts` | LoginSchema + ResetPasswordSchema gone |

Keep `app/api/v1/auth/logout/route.ts` — still needed for OAuth sessions.

---

## DB Migration: `db/migrations/0003_google_oauth_viewer_invites.sql`

```sql
-- 1. Add viewer to role enum
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'viewer';

-- 2. staff_status enum
CREATE TYPE "public"."staff_status" AS ENUM('pending', 'active', 'deactivated');

-- 3. Add status to staff_users (default active keeps existing rows intact)
ALTER TABLE "staff_users"
  ADD COLUMN "status" "staff_status" NOT NULL DEFAULT 'active';

-- 4. Make school_id nullable (pending users have no school yet)
ALTER TABLE "staff_users"
  ALTER COLUMN "school_id" DROP NOT NULL;

-- 5. staff_invites — pre-configured invite links
CREATE TABLE "staff_invites" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "token"             uuid NOT NULL DEFAULT gen_random_uuid(),
  "school_id"         uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "role"              "role" NOT NULL DEFAULT 'editor',
  "grade_scopes"      integer[] NOT NULL DEFAULT '{}',
  "event_type_scopes" text[] NOT NULL DEFAULT '{}',  -- store event_type keys, not UUIDs
  "created_by"        uuid NOT NULL REFERENCES "staff_users"("id"),
  "expires_at"        timestamptz NOT NULL,
  "used_at"           timestamptz,
  "used_by"           uuid REFERENCES "staff_users"("id"),
  "created_at"        timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "staff_invites_token_unique" UNIQUE("token")
);
ALTER TABLE "staff_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_invites" FORCE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "staff_invites"
  AS PERMISSIVE FOR ALL TO public
  USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid)
  WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);
CREATE INDEX "staff_invites_token_idx" ON "staff_invites"("token");

-- 6. pending_registrations — no RLS, service-role only
CREATE TABLE "pending_registrations" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "auth_user_id"     uuid NOT NULL UNIQUE,
  "email"            varchar(255) NOT NULL,
  "full_name"        text NOT NULL DEFAULT '',
  "google_avatar_url" text,
  "requested_at"     timestamptz DEFAULT now() NOT NULL,
  "reviewed_at"      timestamptz,
  "reviewed_by"      uuid REFERENCES "staff_users"("id"),
  "review_outcome"   varchar(16)  -- 'approved' | 'rejected'
);
```

---

## Drizzle Schema Changes (`lib/db/schema.ts`)

1. Add `staffStatusEnum = pgEnum("staff_status", ["pending", "active", "deactivated"])`
2. Add `"viewer"` to `roleEnum`
3. `staffUsers`: `schoolId` → remove `.notNull()`; add `status: staffStatusEnum().notNull().default("active")`
4. Add `staffInvites` table (matches SQL above; `event_type_scopes: text("event_type_scopes").array()`)
5. Add `pendingRegistrations` table (no `schoolIsolation` policy)

---

## Type Changes

### `lib/db/staff.ts` — `StaffUserRecord`

```ts
export interface StaffUserRecord {
  id: string;
  schoolId: string | null;  // null only while status='pending'
  schoolSlug: string | null;
  role: "editor" | "admin" | "viewer";
  email: string;
  fullName: string;
  status: "pending" | "active" | "deactivated";
}
```

Update `getStaffUserByAuthId()`: LEFT JOIN `schools` to get `schoolSlug`; include `status`.

### `lib/auth/scopes.ts` — `StaffUser`

```ts
export interface StaffUser {
  id: string;
  schoolId: string;
  role: "editor" | "admin" | "viewer";
}
// assertEditorScope: add early return throw for viewer role (403 "viewers cannot edit")
```

### `lib/auth/admin.ts` — `assertAdmin`

Add `status !== 'active'` check before role check.

---

## New Files

### `app/auth/callback/route.ts` — OAuth callback

Decision tree after `exchangeCodeForSession(code)`:
```
getStaffUserByAuthId(authId)
├─ found + active       → redirect(next ?? "/dashboard")
├─ found + deactivated  → signOut + redirect("/auth/deactivated")
├─ found + pending      → redirect("/auth/pending")
└─ not found
   ├─ invite_token in searchParams?
   │  ├─ valid invite  → createStaffUserFromInvite() + markInviteUsed() → redirect(next)
   │  └─ invalid/expired → redirect("/invite/[token]?error=expired")
   └─ no invite
      ├─ already in pending_registrations → redirect("/auth/pending")
      └─ new → createPendingRegistration() → redirect("/auth/pending")
```

Uses `createSupabaseServerClient()` (cookie-based). Returns `NextResponse.redirect()`.

Google user_metadata fallback: `full_name ?? name ?? email`.

### `app/auth/login/page.tsx` — Sign-in page (Server Component)

Renders `<GoogleSignInButton>` client island. Reads `searchParams.next` and `searchParams.token`.

### `components/auth/GoogleSignInButton.tsx` — Client Component

```ts
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${appUrl}/auth/callback?next=${next}${token ? `&invite_token=${token}` : ''}`,
  }
})
```

### `app/auth/pending/page.tsx` — "Awaiting approval" page (no auth required)

Hebrew/English message. Sign-out button.

### `app/auth/deactivated/page.tsx` — "Account deactivated" page (no auth required)

Hebrew/English message. Sign-out button.

### `app/invite/[token]/page.tsx` — Invite landing (Server Component)

Load invite by token (service-role, no `withSchool`). If valid → `redirect("/auth/login?token=TOKEN&next=/dashboard")`. If expired/used → render error UI.

### `lib/db/invites.ts`

```ts
createInvite(params: { schoolId, role, gradeScopes, eventTypeScopes, createdBy, expiresInHours? }): Promise<{ token: string }>
getInviteByToken(token: string): Promise<InviteRecord | null>  // raw db, no withSchool
markInviteUsed(token: string, usedBy: string): Promise<void>
listInvitesForSchool(schoolId: string): Promise<InviteRecord[]>  // withSchool
```

### `lib/db/pending.ts`

```ts
createPendingRegistration(params): Promise<void>
getPendingRegistrationByAuthId(authUserId: string): Promise<PendingRegistrationRecord | null>
listPendingRegistrations(): Promise<PendingRegistrationRecord[]>  // raw db, service-role
approvePendingRegistration(params: { pendingId, schoolId, role, fullName, gradeScopes?, eventTypeScopes?, approvedBy }): Promise<{ staffUserId: string }>
rejectPendingRegistration(params: { pendingId, reviewedBy }): Promise<void>
  // Also calls supabaseAdmin.auth.admin.deleteUser(authUserId) on reject
```

`approvePendingRegistration` handles duplicate-insert race via `ON CONFLICT DO NOTHING` + check rowcount.

### `lib/db/staff.ts` — new function

```ts
createStaffUserFromInvite(params: {
  authUserId: string;
  schoolId: string;
  email: string;
  fullName: string;
  role: "editor" | "admin" | "viewer";
  gradeScopes?: number[];
  eventTypeScopes?: string[];  // event_type keys
}): Promise<{ id: string }>
```

Inserts `staff_users` + `editor_scopes` in `withSchool` transaction. No `supabaseAdmin.auth.admin.createUser()` call — auth user already exists.

### `lib/email/approval.ts`

```ts
sendApprovalEmail(params: { to, fullName, role, loginUrl }): Promise<void>
```

Uses `RESEND_API_KEY`. Called after `approvePendingRegistration`.

### API routes

- `app/api/v1/admin/staff/pending/route.ts` — `GET` (list pending) + `POST` (approve/reject)
- `app/api/v1/admin/staff/invites/route.ts` — `GET` (list invites) + `POST` (create invite, returns `{ token, url }`)

### Viewer route group

- `app/(viewer)/layout.tsx` — requires auth + status=active (any role); redirect unauthenticated → `/auth/login`, pending → `/auth/pending`, deactivated → `/auth/deactivated`
- Pages moved from `(public)` to `(viewer)` (filenames unchanged, URLs unaffected):
  - `app/(viewer)/[school]/page.tsx`
  - `app/(viewer)/[school]/calendar/page.tsx`
  - `app/(viewer)/[school]/agenda/page.tsx`

### Admin UI components

- `components/admin/PendingRequestsTable.tsx` — columns: email, name, requested at, Approve/Reject actions. Approve opens modal: full name (editable), role, school (auto for single-school), grade+event-type scopes (if editor).
- `components/admin/InviteTable.tsx` — columns: role, scopes, expires, status (active/used/expired), copy URL button.
- `components/admin/InviteForm.tsx` — role, grade scopes (if editor), event type scopes (if editor), expires in hours. Returns generated URL.

### Validation schemas (`lib/validations/admin.ts`)

Add:
```ts
StaffInviteCreateSchema = z.object({ role, gradeScopes?, eventTypeScopes?, expiresInHours? })
ApprovePendingSchema = z.object({ pendingId, action: 'approve'|'reject', schoolId?, role?, fullName?, gradeScopes?, eventTypeScopes? })
```

Remove `temporaryPassword` from `StaffUserCreateSchema` (or remove the schema entirely if direct creation is removed).

---

## Modified Files

### `middleware.ts`

Add auth gate — redirect unauthenticated requests to `/auth/login?next=PATH`.

Public allowlist (no redirect):
```
/auth/login, /auth/callback, /auth/pending, /auth/deactivated
/invite/
/ical/           (token-gated feed, intentionally unauthenticated)
/_next/, /favicon.ico
```

Remove `api/v1/auth/` from the old matcher exclusion.

### `app/(staff)/layout.tsx`

- Change redirect target from `"/"` → `"/auth/login"`
- Add: `if (user.status === "deactivated") redirect("/auth/deactivated")`
- Add: `if (user.status === "pending") redirect("/auth/pending")`
- Add: `if (user.role === "viewer") redirect(\`/${user.schoolSlug}\`)`

### `app/(admin)/layout.tsx`

- Change redirect target from `"/"` → `"/auth/login"`
- Add status checks (pending → `/auth/pending`, deactivated → `/auth/deactivated`)

### `app/(admin)/admin/staff/page.tsx`

Fetch and pass `pendingRegs` and `invites` alongside existing `staff` and `eventTypes`. Render three sections: Active Staff, Pending Requests, Invites.

### `messages/he.json` + `messages/en.json`

Add keys: `auth.signInWithGoogle`, `auth.pendingTitle`, `auth.pendingBody`, `auth.deactivatedTitle`, `auth.deactivatedBody`, `auth.signOut`, `admin.staff.pendingRequests`, `admin.staff.approve`, `admin.staff.reject`, `admin.staff.createInvite`, `admin.staff.inviteCopied`, `admin.staff.roleViewer`.

### `db/seed.ts`

Remove `temporaryPassword` from all seed user creation calls. Seed users created with `email_confirm: true`, no password. Local dev: use Supabase dashboard "Login as user" for manual testing.

---

## Implementation Order

1. Write + run migration `0003`
2. Update `lib/db/schema.ts`
3. Update `StaffUserRecord` + `getStaffUserByAuthId()` in `lib/db/staff.ts`
4. Update `lib/auth/admin.ts` and `lib/auth/scopes.ts`
5. Update layout guards: `(staff)`, `(admin)` — new redirect targets + status checks
6. Create `app/auth/callback/route.ts`, `app/auth/login/page.tsx`, `app/auth/pending/page.tsx`, `app/auth/deactivated/page.tsx`, `components/auth/GoogleSignInButton.tsx`
7. Update `middleware.ts` (auth gate + new public allowlist)
8. Create `lib/db/invites.ts`, `lib/db/pending.ts`
9. Add `createStaffUserFromInvite()` to `lib/db/staff.ts`
10. Create `app/invite/[token]/page.tsx`
11. Create admin API routes for pending + invites
12. Create admin UI components (PendingRequestsTable, InviteTable, InviteForm)
13. Update `app/(admin)/admin/staff/page.tsx`
14. Move `(public)` → `(viewer)`, update `(viewer)/layout.tsx`
15. Create `lib/email/approval.ts`; wire into `approvePendingRegistration`
16. Add i18n keys to `he.json` + `en.json`
17. Delete `app/api/v1/auth/login/route.ts`, `app/api/v1/auth/reset-password/route.ts`, `lib/validations/auth.ts`
18. Update `db/seed.ts`
19. Rewrite `test/integration/auth.test.ts` → OAuth callback flow tests
20. Add invite + pending unit tests

---

## Verification

1. `pnpm tsc --noEmit` — no type errors
2. `pnpm lint` — no ESLint violations
3. `pnpm test` — all tests pass
4. Manual E2E:
   - Visit any protected route unauthenticated → lands on `/auth/login`
   - Click "Sign in with Google" → Google OAuth → callback → lands on `/dashboard` (if active) or `/auth/pending` (if new)
   - Admin approves pending user → user receives email → user can sign in and access app
   - Admin creates invite → visit invite URL → sign in with Google → auto-approved with correct role/scopes
   - Viewer cannot access `/dashboard` → redirected to `/:schoolSlug`
   - Viewer cannot POST to `/api/v1/events` → 403
5. `pnpm playwright test` — existing E2E suite passes (auth stubs may need updating)
