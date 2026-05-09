# Phase 1: Database, RLS & Auth — Research

**Researched:** 2026-05-09
**Domain:** Drizzle ORM + Postgres RLS + Supabase Auth + Next.js App Router
**Confidence:** HIGH (core stack verified via official docs and npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Supabase project already provisioned — executor connects to the existing project. No `supabase init`, no project creation step.
- **D-02:** `.env.local` credentials are NOT yet filled in. Executor must pause at a `checkpoint:human-action` early in execution to collect `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `RESEND_API_KEY`. Do NOT attempt to connect to Supabase before the user has supplied the keys.

### Claude's Discretion

- **Password reset + Resend integration** — Claude chooses the Resend wiring approach for AUTH-02. Prefer the approach that keeps the implementation inside Next.js routes rather than Supabase Edge Functions.
- **Auth route protection** — Claude decides between blanket `middleware.ts` for staff/admin routes vs per-layout `getSession()` checks. Either is acceptable; prefer whatever integrates cleanly with Next.js App Router layout hierarchy.
- **Failed-login lockout** — Claude implements AUTH-03 using the `staff_users.locked_until` column. Track attempt count + expiry in the DB; Supabase Auth rate limiting is a secondary safeguard, not the primary enforcement mechanism.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DB-01 | All PRD tables exist with correct schema | Drizzle `pgTable` patterns; column types documented |
| DB-02 | Postgres RLS enforces `school_id = current_setting('app.school_id')` on every school-scoped table | RLS SQL + Drizzle `pgPolicy` patterns documented |
| DB-03 | `db.withSchool(schoolId, fn)` wrapper sets `app.school_id`; all queries inside are RLS-scoped | `set_config` + transaction pattern documented |
| DB-04 | ESLint rule prevents importing `supabaseAdmin` outside `lib/db/` | Flat config `no-restricted-imports` override pattern documented |
| DB-05 | Cross-school access returns 404 (not 403) | API route layer responsibility; RLS denial → empty result → 404 pattern documented |
| DB-06 | Seed script creates one school, one admin, six grade-supervisor editors, one counselor editor, 11 event types | `onConflictDoUpdate` idempotent upsert pattern documented |
| AUTH-01 | Staff user can log in with email + password via Supabase Auth | `@supabase/ssr` `createServerClient` + login route pattern documented |
| AUTH-02 | Staff user can request password reset; receives email via Resend | Resend SMTP relay + Supabase Auth webhook approach documented; Next.js route handler pattern recommended |
| AUTH-03 | Account locks after 10 failed login attempts within 15 minutes | DB-backed lockout in `staff_users.locked_until`; custom API login route pattern documented |
| AUTH-04 | `getSession()` server helper returns current authenticated user | `supabase.auth.getUser()` in server helper documented (not `getSession`) |
| AUTH-05 | `assertEditorScope(user, grade?, eventType?)` throws 403 on scope violation | `editor_scopes` table query pattern documented |
| AUTH-06 | Admins can access all school data; editors restricted by `editor_scopes` | Role check + scope check in `lib/auth/scopes.ts` pattern documented |
| AUTH-07 | Public routes are fully unauthenticated — no session check | Middleware matcher exclusion pattern documented |
</phase_requirements>

---

## Summary

Phase 1 establishes the complete data and auth foundation for the multi-tenant school system. The tech stack is well-understood: Drizzle ORM (with the `pg` driver via `node-postgres`) handles schema definition and typed queries; Postgres RLS policies gated on the `app.school_id` session variable provide tenant isolation; Supabase Auth (`@supabase/ssr`) manages email+password login and token refresh in Next.js App Router.

The most critical architectural decision is the `db.withSchool(schoolId, fn)` wrapper, which MUST open a `db.transaction()`, set the session variable with `set_config('app.school_id', schoolId, TRUE)` inside the transaction, execute the callback, and commit. Without this transaction wrapping, `set_config` with `is_local=TRUE` (which is `SET LOCAL`) has no effect and RLS sees no tenant context. This is the same pattern used by Drizzle's own Supabase RLS documentation.

Password reset email (AUTH-02) is implemented as a Supabase Auth "Send Email" hook targeting a Next.js API route handler (not an Edge Function), following the CONTEXT.md discretion to keep implementation inside Next.js. The hook sends a POST with a signed payload; the route handler verifies the signature with `standardwebhooks` and calls Resend SDK to dispatch the email. Alternatively, configuring Resend as a custom SMTP relay via the Supabase Auth dashboard is the zero-code option — recommended for simplicity.

**Primary recommendation:** Wire Resend as a custom SMTP relay in the Supabase Auth dashboard for password reset (zero code path), and implement the Send Email Hook route handler as a fallback only if custom HTML templates are required in Phase 1.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | ^0.45.2 | Type-safe ORM for schema definition and queries | Official Supabase integration; pure TS schema; `pgTable` + `pgPolicy` for RLS |
| `drizzle-kit` | ^0.31.x | Migration generation and DB push CLI | Pairs with `drizzle-orm`; generates SQL files for `db/migrations/` |
| `pg` | ^8.20.0 | PostgreSQL client (node-postgres Pool) | Required by `drizzle-orm/node-postgres`; service-role direct connection |
| `@types/pg` | ^8.20.0 | TypeScript types for `pg` | Required for strict TS |
| `@supabase/supabase-js` | ^2.105.3 | Supabase Auth client (anon key) | Supabase official SDK for browser + server auth |
| `@supabase/ssr` | ^0.10.2 | Cookie-based SSR auth for Next.js App Router | Official replacement for deprecated `@supabase/auth-helpers-nextjs` |
| `resend` | ^6.12.3 | Email delivery for password reset | Project-mandated in CLAUDE.md |
| `zod` | ^3.x | Runtime validation at API boundaries | Project-mandated in CLAUDE.md; already in use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `standardwebhooks` | ^1.0.0 | Verify Supabase Auth hook webhook signatures | Only if custom Send Email Hook route is implemented instead of SMTP relay |
| `dotenv` | (pnpm workspace) | Load `.env.local` in seed scripts | `db/seed.ts` runs outside Next.js so needs explicit dotenv load |

### Not Needed

| Instead of | Reason |
|------------|--------|
| `@supabase/auth-helpers-nextjs` | Deprecated; replaced by `@supabase/ssr` |
| Supabase Edge Functions for email | CONTEXT.md specifies Next.js routes; SMTP relay is simpler |
| Custom JWT handling | Supabase Auth manages JWTs; we only validate via `getUser()` |

**Installation:**

```bash
pnpm add drizzle-orm pg @supabase/supabase-js @supabase/ssr resend zod
pnpm add -D drizzle-kit @types/pg
# Optional (only if webhook signature verification needed):
pnpm add standardwebhooks
```

**Version verification:** Verified via npm registry search 2026-05-09. `drizzle-orm` 0.45.2, `drizzle-kit` 0.31.x, `pg` 8.20.0, `@supabase/supabase-js` 2.105.3, `@supabase/ssr` 0.10.2, `resend` 6.12.3.

---

## Architecture Patterns

### Recommended Directory Structure for Phase 1

```
lib/
  db/
    schema.ts          — all pgTable definitions + pgEnum + pgPolicy (DB-01, DB-02)
    client.ts          — Drizzle instance (pg Pool), supabaseAdmin (service-role), withSchool() (DB-03)
    index.ts           — re-exports db (not supabaseAdmin) for use outside lib/db/
  auth/
    session.ts         — getSession() server helper wrapping supabase.auth.getUser() (AUTH-04)
    scopes.ts          — assertEditorScope() scope check (AUTH-05, AUTH-06)
db/
  migrations/
    0001_initial.sql   — single migration creating all tables + enabling RLS + policies
  seed.ts              — idempotent school bootstrap (DB-06)
app/
  api/
    v1/
      auth/
        login/route.ts        — POST handler: lockout check → supabase signIn (AUTH-01, AUTH-03)
        logout/route.ts       — POST handler: supabase signOut (AUTH-01)
        reset-password/route.ts — POST handler: trigger resetPasswordForEmail (AUTH-02)
        email-hook/route.ts   — POST handler: Supabase Send Email Hook → Resend (AUTH-02, optional)
middleware.ts              — compose next-intl + Supabase session refresh (AUTH-07)
drizzle.config.ts          — Drizzle Kit configuration
```

### Pattern 1: Drizzle Schema Definition

**What:** All tables defined in `lib/db/schema.ts` using `pgTable` and `pgPolicy`.
**When to use:** Every table that touches school data — always.

```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg and https://orm.drizzle.team/docs/rls
import {
  pgTable, pgEnum, pgPolicy, uuid, text, varchar,
  boolean, integer, timestamp, jsonb, index
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['editor', 'admin']);
export const statusEnum = pgEnum('event_status', ['draft', 'pending', 'approved', 'rejected']);
export const scopeKindEnum = pgEnum('scope_kind', ['grade', 'event_type']);

export const schools = pgTable('schools', {
  id:                   uuid().defaultRandom().primaryKey(),
  slug:                 varchar({ length: 64 }).notNull().unique(),
  name:                 text().notNull(),
  locale:               varchar({ length: 8 }).notNull().default('he'),
  timezone:             varchar({ length: 64 }).notNull().default('Asia/Jerusalem'),
  activeAcademicYearId: uuid(),
  createdAt:            timestamp({ withTimezone: true }).defaultNow().notNull(),
});
// schools has no school_id FK — it IS the tenant root, so no RLS on this table

export const staffUsers = pgTable('staff_users', {
  id:          uuid().defaultRandom().primaryKey(),
  schoolId:    uuid().notNull().references(() => schools.id),
  email:       varchar({ length: 255 }).notNull().unique(),
  fullName:    text().notNull(),
  role:        roleEnum().notNull().default('editor'),
  lockedUntil: timestamp({ withTimezone: true }),
  loginAttempts: integer().notNull().default(0),
  createdAt:   timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  pgPolicy('staff_school_isolation', {
    as: 'permissive',
    for: 'all',
    using: sql`school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid`,
    withCheck: sql`school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid`,
  }),
]);
// Repeat pgPolicy pattern for: academic_years, editor_scopes, event_types,
// events, event_grades, event_revisions, ical_subscriptions, audit_log
```

**Important:** `pgPolicy` on a table in Drizzle automatically enables RLS on that table in the generated migration SQL.

### Pattern 2: `db.withSchool()` Wrapper

**What:** Opens a Drizzle transaction, sets `app.school_id` as a session-local variable, executes the callback, commits. All RLS policies read this variable.
**When to use:** Every database call that touches school-scoped tables. NEVER bypass.

```typescript
// Source: https://orm.drizzle.team/docs/rls — createDrizzle wrapper pattern adapted
// File: lib/db/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// supabaseAdmin — ONLY used for admin tasks (user creation, bypassing RLS intentionally)
// ESLint rule prevents importing this outside lib/db/
export { supabaseAdmin } from './supabase-admin'; // separate file keeps the export clean

export async function withSchool<T>(
  schoolId: string,
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config with is_local=TRUE → behaves like SET LOCAL; scoped to this transaction
    await tx.execute(
      sql`SELECT set_config('app.school_id', ${schoolId}, TRUE)`
    );
    return fn(tx as unknown as typeof db);
  });
}
```

**Critical:** `set_config('app.school_id', value, TRUE)` — the third argument `TRUE` makes it transaction-local (`SET LOCAL` semantics). Without the transaction wrapper, this has no effect on subsequent statements.

**Connection pool note:** Because we always use `SET LOCAL` inside a transaction (not `SET` at the session level), this is safe with pgbouncer in transaction pooling mode and with Supabase's built-in connection pooler.

### Pattern 3: Supabase Auth + Next.js App Router Middleware

**What:** Single `middleware.ts` that chains `next-intl` locale routing with Supabase session refresh.
**When to use:** Applied to all routes; public routes pass through without session enforcement.

```typescript
// Source: https://github.com/amannn/next-intl/discussions/422
// File: middleware.ts
import { type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';

const handleI18nRouting = createIntlMiddleware({
  locales: ['he', 'en'],
  defaultLocale: 'he',
});

export async function middleware(request: NextRequest) {
  // Run i18n routing first — it returns the (potentially redirected) response
  const response = handleI18nRouting(request);

  // Supabase needs to refresh the JWT and set cookies on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() validates the JWT server-side; refreshes token if needed
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    // Match all except _next static, images, favicon, and api routes that skip session
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Auth enforcement** (protected layouts, NOT middleware): In `app/(staff)/layout.tsx` and `app/(admin)/layout.tsx`, call `getSession()` and redirect to `/login` if no session.

### Pattern 4: `getSession()` Server Helper

**What:** Returns the authenticated Supabase user from a Server Component or Route Handler.
**Security note:** Use `getUser()` (makes a network call to Supabase Auth to revalidate the JWT), never `getSession()` alone — `getSession()` does not verify JWT authenticity server-side.

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// File: lib/auth/session.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

### Pattern 5: `assertEditorScope()` Implementation

**What:** Queries `editor_scopes` to verify the editor is allowed to act on a given grade or event type. Throws a 403 Response on violation.
**When to use:** Every staff API route that performs writes.

```typescript
// File: lib/auth/scopes.ts
import { db, withSchool } from '@/lib/db/client';
import { eq, and } from 'drizzle-orm';
import { editorScopes } from '@/lib/db/schema';

export interface StaffUser {
  id: string;
  schoolId: string;
  role: 'editor' | 'admin';
}

export async function assertEditorScope(
  user: StaffUser,
  grade?: number,
  eventType?: string,
): Promise<void> {
  if (user.role === 'admin') return; // Admins bypass scope checks (AUTH-06)

  // Check grade scope if provided
  if (grade !== undefined) {
    const rows = await withSchool(user.schoolId, (tx) =>
      tx.query.editorScopes.findMany({
        where: and(
          eq(editorScopes.staffUserId, user.id),
          eq(editorScopes.scopeKind, 'grade'),
          eq(editorScopes.scopeValue, String(grade)),
        ),
      })
    );
    if (rows.length === 0) throw new Response('Forbidden', { status: 403 });
  }

  // Check event-type scope if provided
  if (eventType !== undefined) {
    const rows = await withSchool(user.schoolId, (tx) =>
      tx.query.editorScopes.findMany({
        where: and(
          eq(editorScopes.staffUserId, user.id),
          eq(editorScopes.scopeKind, 'event_type'),
          eq(editorScopes.scopeValue, eventType),
        ),
      })
    );
    if (rows.length === 0) throw new Response('Forbidden', { status: 403 });
  }
}
```

### Pattern 6: Custom Login Route with Lockout (AUTH-03)

**What:** A Next.js Route Handler that checks `locked_until` and `login_attempts` BEFORE calling Supabase Auth. On failure: increment `login_attempts`; if >= 10 within 15 min window, set `locked_until = NOW() + 15m`. On success: reset both to 0.

```typescript
// File: app/api/v1/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client'; // service-role for user management only
import { db, withSchool } from '@/lib/db/client';
import { eq } from 'drizzle-orm';
import { staffUsers } from '@/lib/db/schema';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  schoolId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { email, password, schoolId } = parsed.data;

  // Step 1: Fetch staff_user record (use service-role to bypass RLS for lookup)
  // This is intentional — we need to find the user BEFORE setting school context
  const [staffUser] = await db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.email, email))
    .limit(1);

  if (!staffUser || staffUser.schoolId !== schoolId) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Step 2: Check lockout
  const now = new Date();
  if (staffUser.lockedUntil && staffUser.lockedUntil > now) {
    return NextResponse.json({ error: 'Account locked. Try again later.' }, { status: 423 });
  }

  // Step 3: Attempt Supabase Auth sign-in
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  if (error) {
    // Increment attempt counter; lock if >= 10
    const newAttempts = (staffUser.loginAttempts ?? 0) + 1;
    const lockedUntil = newAttempts >= 10
      ? new Date(now.getTime() + 15 * 60 * 1000)
      : null;
    await db.update(staffUsers)
      .set({ loginAttempts: newAttempts, lockedUntil })
      .where(eq(staffUsers.id, staffUser.id));
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Step 4: Reset counter on success
  await db.update(staffUsers)
    .set({ loginAttempts: 0, lockedUntil: null })
    .where(eq(staffUsers.id, staffUser.id));

  return NextResponse.json({ user: data.user }, { status: 200 });
}
```

**Note:** The `staffUsers` lookup outside `withSchool()` is intentional here — we need to find the user to determine the school context. This is a service-role operation (admin bypasses RLS). An alternative is to look up by `email` only at the Supabase Auth level first and then use the returned `user.id` to find the `staff_user`.

### Pattern 7: ESLint Rule for `supabaseAdmin` Import Restriction (DB-04)

**What:** ESLint flat config that bans importing `supabaseAdmin` (or anything from `@/lib/db/client` that is `supabaseAdmin`) outside `lib/db/`. Uses file-scoped override.

```javascript
// File: eslint.config.mjs (additions to existing config)
export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // Global rule: ban supabaseAdmin import everywhere
  {
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@/lib/db/client',
          importNames: ['supabaseAdmin'],
          message: 'supabaseAdmin is restricted to lib/db/. Use db.withSchool() instead.',
        }],
      }],
    },
  },
  // Override: allow supabaseAdmin inside lib/db/ itself
  {
    files: ['lib/db/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
```

### Pattern 8: Seed Script with Idempotent Upserts (DB-06)

**What:** `db/seed.ts` inserts all reference data using `onConflictDoUpdate` so re-runs don't duplicate data.

```typescript
// Source: https://orm.drizzle.team/docs/guides/upsert
// File: db/seed.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { schools, staffUsers, editorScopes, eventTypes } from '@/lib/db/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const seedDb = drizzle({ client: pool });

// Seed order: schools → academic_years → staff_users → editor_scopes → event_types
// Use onConflictDoUpdate with a stable unique key (slug, email, key) as target

await seedDb.insert(schools).values({
  slug: 'demo-school',
  name: 'Demo School',
}).onConflictDoUpdate({
  target: schools.slug,
  set: { name: sql`excluded.name` },
});

// Supabase Auth user creation uses supabaseAdmin.auth.admin.createUser() (not Drizzle)
// Then insert staff_users row pointing to the auth.users.id
```

**Execution:** `pnpm tsx db/seed.ts` (requires `tsx` in devDependencies or `ts-node`).

### Anti-Patterns to Avoid

- **`SET` without `SET LOCAL`:** Using `set_config('app.school_id', value, FALSE)` sets a session-level variable that persists across requests in a pooled connection. Always pass `TRUE` (local/transaction-scoped).
- **RLS on `schools` table:** The `schools` table has no `school_id` foreign key to itself — do NOT add RLS on it with this pattern. Use application-level checks instead.
- **`getSession()` in server code for auth enforcement:** `getSession()` reads from the cookie without validating with Supabase Auth server. Use `getUser()` for authorization decisions.
- **`supabaseAdmin` outside `lib/db/`:** The service-role client bypasses RLS. Only use inside `lib/db/client.ts` for admin operations (seed, user creation).
- **Direct `events.status` mutation:** All status transitions must go through `lib/events/approval.ts` (future phase, but the RLS and schema foundation must not prevent this).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password reset email delivery | Custom SMTP client | Resend SDK / Supabase SMTP relay | SPF/DKIM/DMARC handled; deliverability built-in |
| JWT verification | Custom JWT decode + verify | `supabase.auth.getUser()` | Validates against Supabase Auth server; handles rotation |
| Cookie session management | Custom cookie helpers | `@supabase/ssr` `createServerClient` | Handles httpOnly, SameSite, refresh; cross-framework |
| Tenant isolation in queries | Custom `WHERE school_id = ?` on every query | Postgres RLS via `withSchool()` | Enforced at DB level; can't be bypassed by accident |
| Migration tracking | Custom migration table | `drizzle-kit` migration files | Idempotent, reversible, version-controlled |
| Webhook signature verification | Custom HMAC check | `standardwebhooks` library | Timing-safe; handles all Standard Webhooks spec edge cases |

---

## Password Reset / Email Approach (Claude's Discretion Resolution)

Two options exist; option A is strongly preferred:

**Option A: Resend SMTP Relay (recommended — zero code)**
Configure Resend as Supabase's custom SMTP provider:
- Resend dashboard → SMTP → generate credentials
- Supabase Auth dashboard → Settings → SMTP → enter `smtp.resend.com:587`, user/pass from Resend
- Supabase triggers password reset emails through Resend automatically
- No code to write; no Edge Functions; no route handler
- Default email templates (HTML can be customized in Supabase dashboard)

**Option B: Send Email Hook → Next.js Route Handler (if custom templates required)**
- Supabase Auth → Hooks → Send Email → HTTPS → point to `POST /api/v1/auth/email-hook`
- Route handler verifies `standardwebhooks` signature, calls Resend SDK with custom template
- Required package: `standardwebhooks` (1.0.0)
- More code, more moving parts, but full template control

**Decision for Phase 1:** Implement Option A (SMTP relay). Document Option B hook endpoint as a future enhancement. This satisfies AUTH-02 with minimal scope.

**Deliverability note from STATE.md:** Hebrew password-reset email deliverability requires SPF/DKIM/DMARC setup on the sending domain — flagged as a known concern; Resend handles DKIM automatically for verified domains.

---

## Common Pitfalls

### Pitfall 1: `set_config` Without a Transaction Wrapper

**What goes wrong:** `SET LOCAL` (or `set_config` with `is_local=TRUE`) only affects the current transaction. If you call it outside a transaction, PostgreSQL quietly creates and immediately commits a transaction around it, and subsequent statements in the same connection do NOT see the setting.
**Why it happens:** Developers test `SET LOCAL` in psql (where each statement is auto-committed) and see it appear to work, but in a connection pool without explicit transactions, the isolation is lost.
**How to avoid:** `withSchool()` MUST use `db.transaction(async (tx) => { ... })`. All queries inside use `tx`, not `db`.
**Warning signs:** RLS policies always see an empty `app.school_id`; queries return empty results (because the policy evaluates `school_id = ''::uuid` which matches nothing).

### Pitfall 2: `getSession()` in Middleware / Server Components

**What goes wrong:** `getSession()` reads the JWT from the cookie and decodes it locally — it does NOT make a network call to Supabase Auth. A tampered or expired JWT may pass the local check.
**Why it happens:** `getSession()` is faster (no network); developers use it for performance.
**How to avoid:** Use `getUser()` for all authorization decisions. Use `getSession()` only when you need the raw access token (e.g., to pass to a downstream API).
**Warning signs:** Supabase docs explicitly warn: "Never trust `getSession()` inside server code such as middleware."

### Pitfall 3: RLS Blocks Seed Script

**What goes wrong:** The seed script connects with the service-role key, which bypasses RLS entirely — so seed inserts work. But if the seed script accidentally uses the anon key (or doesn't use the service-role key), all inserts into RLS-protected tables return "permission denied" or silently return 0 rows.
**How to avoid:** `db/seed.ts` MUST use the `DATABASE_URL` (direct Postgres connection with service-role credentials), not the anon key client. The `drizzle-orm/node-postgres` `Pool` with the service-role connection string bypasses RLS automatically.
**Warning signs:** Seed inserts report `0 rows affected`; no error but data doesn't appear.

### Pitfall 4: ESLint Override Order Matters

**What goes wrong:** In ESLint flat config, the LAST matching config wins. If the `files: ['lib/db/**/*.ts']` override comes BEFORE the global restriction, the global restriction re-applies it.
**How to avoid:** Place the `lib/db/**` exemption AFTER the global `no-restricted-imports` block in `eslint.config.mjs`.
**Warning signs:** ESLint reports `supabaseAdmin` as restricted even inside `lib/db/client.ts`.

### Pitfall 5: Drizzle Migration vs Push

**What goes wrong:** Using `drizzle-kit push` directly against the Supabase production database (it's designed for development; it can truncate or destructively alter tables without a migration file trail).
**How to avoid:** Use `drizzle-kit generate` to create SQL files in `db/migrations/`, review them, then apply via Supabase SQL editor or `drizzle-kit migrate`. This is what CLAUDE.md mandates ("never edit existing migration files; add a new file per change").
**Warning signs:** Running `push` generates no `.sql` file; you lose the audit trail.

### Pitfall 6: Missing `loginAttempts` Column in `staff_users`

**What goes wrong:** CLAUDE.md's short-form data model shows `locked_until` but not `login_attempts`. AUTH-03 requires tracking the count to reach the 10-attempt threshold.
**How to avoid:** Add `loginAttempts integer not null default 0` to `staff_users` in the migration. This is a Phase 1 addition not in the short-form schema.
**Warning signs:** Lockout never triggers because there's no counter to check.

### Pitfall 7: Cross-School 404 vs 403

**What goes wrong:** RLS causes queries to return 0 rows (empty result) rather than throwing a permission error. If API routes check for empty results and return 403, this violates DB-05 (must return 404).
**How to avoid:** In Route Handlers, check if the result of a `withSchool()` query is null/empty → return 404, not 403. The 403 is reserved for scope violations (`assertEditorScope` throws).
**Warning signs:** Cross-school access returns 403 in tests; DB-05 integration test fails.

---

## Code Examples

### Full RLS Policy SQL (for reference in migration)

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- and https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres

-- Enable RLS on school-scoped tables
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ical_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy pattern (repeated per table):
CREATE POLICY "school_isolation" ON staff_users
  AS PERMISSIVE
  FOR ALL
  USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid)
  WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);

-- The NULLIF handles the case where app.school_id is '' (empty string = unset)
-- Casting to uuid ensures type safety; invalid UUIDs will fail rather than match accidentally
```

### Supabase Auth Admin — Create User (for seed script)

```typescript
// Used in db/seed.ts; supabaseAdmin bypasses Auth rate limits
const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
  email: 'admin@demo-school.test',
  password: 'changeme123!',
  email_confirm: true, // Skip email confirmation for seed users
});
// Then insert into staff_users with authUser.user.id as the id
```

### Drizzle Kit Configuration

```typescript
// File: drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './db/migrations',
  schema: './lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023–2024 | Auth Helpers deprecated; SSR package is the official replacement |
| `getSession()` for server auth | `getUser()` for server auth | Ongoing Supabase guidance | `getSession()` insecure server-side; `getUser()` validates against Auth server |
| Supabase Edge Functions for email hooks | Next.js route handlers are viable | Always possible | Supabase's "Send Email Hook" accepts any HTTPS endpoint; Edge Functions are not required |
| `drizzle-kit push` for all envs | `push` for dev only; `generate` + SQL files for staging/prod | Drizzle convention | `push` is destructive in production; migration files provide audit trail |
| `set role` for RLS tenant | `set_config('app.school_id', ...)` | Supabase recommendation | Works with connection poolers in transaction mode; doesn't require per-tenant DB roles |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22 | pnpm scripts, `next dev` | Check at runtime | Provisioned by Phase 0 | — |
| Supabase project (remote) | All DB + Auth tasks | Assumed (D-01) | — | `checkpoint:human-action` to confirm |
| Supabase env vars | All DB + Auth connections | NOT yet in `.env.local` (D-02) | — | `checkpoint:human-action` required before any DB work |
| Resend API key | AUTH-02 | NOT yet in `.env.local` (D-02) | — | `checkpoint:human-action` |
| `tsx` or `ts-node` | `db/seed.ts` execution | Not in package.json | — | Add `tsx` as devDependency |

**Missing dependencies with no fallback:**
- Supabase env vars: executor MUST pause for `checkpoint:human-action` before running any migration, seed, or auth test.

**Missing dependencies with fallback:**
- `tsx` (for seed script): add `pnpm add -D tsx` if not present; alternatively add `"seed": "tsx db/seed.ts"` to scripts.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (exists, uses jsdom) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test:coverage` |
| Integration test run | `vitest run --project integration` (new project config needed) |

### Integration Test Configuration Gap

The current `vitest.config.ts` uses `environment: 'jsdom'` and only includes `test/unit/**` and `lib/**` tests. Integration tests that connect to a real Postgres database require a different Vitest project with `environment: 'node'`. A second project block is needed.

```typescript
// Addition to vitest.config.ts — project separation
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    projects: [
      {
        name: 'unit',
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        include: ['test/unit/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
      },
      {
        name: 'integration',
        environment: 'node',
        setupFiles: ['./test/integration/setup.ts'],
        include: ['test/integration/**/*.test.ts'],
      },
    ],
  },
});
```

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | All tables exist in Postgres | integration | `vitest run --project integration test/integration/schema.test.ts` | Wave 0 |
| DB-02 | RLS enforces school_id isolation | integration | `vitest run --project integration test/integration/rls.test.ts` | Wave 0 |
| DB-03 | `withSchool()` sets session var correctly | integration | `vitest run --project integration test/integration/rls.test.ts` | Wave 0 |
| DB-04 | ESLint blocks supabaseAdmin import | lint | `pnpm lint` | Wave 0 (config change) |
| DB-05 | Cross-school request returns 404 | integration | `vitest run --project integration test/integration/rls.test.ts` | Wave 0 |
| DB-06 | Seed creates expected rows | integration | `vitest run --project integration test/integration/seed.test.ts` | Wave 0 |
| AUTH-01 | Staff user can log in | integration | `vitest run --project integration test/integration/auth.test.ts` | Wave 0 |
| AUTH-02 | Password reset triggers email | manual | Verify via Resend dashboard after triggering reset | N/A |
| AUTH-03 | Account locked after 10 failures | integration | `vitest run --project integration test/integration/auth.test.ts` | Wave 0 |
| AUTH-04 | `getSession()` returns user | unit | `pnpm test test/unit/auth/session.test.ts` | Wave 0 |
| AUTH-05 | `assertEditorScope` throws 403 on violation | unit | `pnpm test test/unit/auth/scopes.test.ts` | Wave 0 |
| AUTH-06 | Admin bypasses scope checks | unit | `pnpm test test/unit/auth/scopes.test.ts` | Wave 0 |
| AUTH-07 | Public routes pass without session | integration | `vitest run --project integration test/integration/auth.test.ts` | Wave 0 |

### Integration Test Strategy — RLS Verification

The key tests for DB-02, DB-03, DB-05 are:

**Positive RLS access test:**
```typescript
it('withSchool returns school A data when scoped to school A', async () => {
  const rows = await withSchool(schoolAId, (tx) =>
    tx.select().from(eventTypes).where(eq(eventTypes.schoolId, schoolAId))
  );
  expect(rows.length).toBeGreaterThan(0);
});
```

**Negative RLS cross-school test (DB-05):**
```typescript
it('withSchool scoped to school A cannot read school B data', async () => {
  const rows = await withSchool(schoolAId, (tx) =>
    tx.select().from(eventTypes).where(eq(eventTypes.schoolId, schoolBId))
  );
  // RLS filters out school B rows; result is empty (not an error)
  expect(rows).toHaveLength(0);
});
```

**API route cross-school 404 test:**
```typescript
it('GET /api/v1/events/:id returns 404 for cross-school access', async () => {
  // Create event in school B, authenticate as school A user
  const response = await fetch(`${BASE_URL}/api/v1/events/${schoolBEventId}`, {
    headers: { Cookie: schoolASessionCookie },
  });
  expect(response.status).toBe(404); // not 403 (DB-05)
});
```

**Auth lockout test:**
```typescript
it('locks account after 10 failed attempts', async () => {
  for (let i = 0; i < 10; i++) {
    await fetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'wrong', schoolId }),
    });
  }
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: correctPassword, schoolId }),
  });
  expect(response.status).toBe(423); // Locked
});
```

**Integration test setup pattern (real Postgres, transaction rollback for isolation):**
```typescript
// File: test/integration/setup.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
export const testDb = drizzle({ client: pool, schema });

// Each test wraps in a transaction and rolls back
beforeEach(async () => { /* start transaction */ });
afterEach(async () => { /* rollback transaction */ });
```

**TEST_DATABASE_URL:** Prefer a separate Supabase test project or a test schema. Do NOT use the production database for integration tests.

### Sampling Rate

- **Per task commit:** `pnpm lint && pnpm tsc --noEmit`
- **Per wave merge:** `pnpm test && pnpm lint && pnpm tsc --noEmit`
- **Phase gate:** Full suite + integration tests green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/integration/setup.ts` — Vitest project config + DB connection + transaction setup
- [ ] `test/integration/rls.test.ts` — DB-02, DB-03, DB-05 (positive + negative RLS cases)
- [ ] `test/integration/auth.test.ts` — AUTH-01, AUTH-03, AUTH-07
- [ ] `test/integration/seed.test.ts` — DB-06 verification
- [ ] `test/unit/auth/session.test.ts` — AUTH-04 unit test
- [ ] `test/unit/auth/scopes.test.ts` — AUTH-05, AUTH-06 unit tests
- [ ] `vitest.config.ts` — add `projects` array separating `unit` (jsdom) and `integration` (node)
- [ ] `drizzle.config.ts` — new file at project root
- [ ] `tsx` devDependency — for `pnpm tsx db/seed.ts` execution

---

## Open Questions

1. **`staff_users.id` vs `auth.users.id` linkage**
   - What we know: Supabase Auth stores users in `auth.users` (Supabase-managed). Our `staff_users` table is in the public schema.
   - What's unclear: Should `staff_users.id` be the same UUID as `auth.users.id`, or a separate ID with a foreign key? The CLAUDE.md schema shows `staff_users.id` without specifying.
   - Recommendation: Make `staff_users.id` equal to the Supabase Auth `user.id` (link by identity). This simplifies joins and eliminates the need for a separate FK column.

2. **TEST_DATABASE_URL for integration tests**
   - What we know: Integration tests need a real Postgres connection.
   - What's unclear: Whether to use a separate Supabase project, a separate schema, or the same project with test-prefixed schemas.
   - Recommendation: Use the same Supabase project with a `test_` prefixed schema, or accept that tests run against the dev database with careful teardown. Flag for human decision at `checkpoint:human-action`.

3. **`next-intl` locale routing with `[school]` dynamic segment**
   - What we know: Public routes are `/[school]/agenda` etc. The `[school]` segment is the tenant slug, not a locale.
   - What's unclear: How `next-intl` middleware interacts when the first path segment is a school slug (e.g., `/demo-school/agenda`) rather than a locale prefix.
   - Recommendation: Configure `next-intl` with `localePrefix: 'never'` or use a subdomain strategy. Alternatively, serve locale via a query param or `Accept-Language` header. Research in Phase 2 when the public routing structure is implemented. Phase 1 middleware should not block on this.

4. **Supabase project's `app.school_id` GUC default**
   - What we know: `current_setting('app.school_id', TRUE)` returns an empty string if not set (the `TRUE` makes it return `''` rather than erroring).
   - What's unclear: Whether the Supabase Postgres instance allows custom GUC parameters (`app.*` namespace) without additional configuration.
   - Recommendation: The `app.*` namespace is a convention that works on standard Postgres. Test this in the first migration; if the Supabase project blocks it, fall back to `SET LOCAL myapp.school_id`.

---

## Sources

### Primary (HIGH confidence)

- [Drizzle ORM — RLS documentation](https://orm.drizzle.team/docs/rls) — `pgPolicy` syntax, `createDrizzle` wrapper, `set_config` in transactions
- [Drizzle ORM — Column types (pg)](https://orm.drizzle.team/docs/column-types/pg) — uuid, text, varchar, timestamp, jsonb, pgEnum syntax
- [Drizzle ORM — Upsert Guide](https://orm.drizzle.team/docs/guides/upsert) — `onConflictDoUpdate` with excluded pattern
- [Drizzle ORM — Transactions](https://orm.drizzle.team/docs/transactions) — `db.transaction()` API
- [Drizzle ORM — Get Started PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new) — Pool connection, drizzle.config.ts
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — `ALTER TABLE ENABLE ROW LEVEL SECURITY`, `CREATE POLICY` syntax
- [Supabase — Setting up SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — middleware pattern, `createServerClient`, `getUser()` vs `getSession()`
- [Supabase — Creating a Supabase Client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — `createServerClient` / `createBrowserClient`
- [Supabase — Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) — webhook payload, signature verification
- [Supabase — Custom SMTP (Resend as relay)](https://supabase.com/docs/guides/auth/auth-smtp) — SMTP relay configuration
- [next-intl × Supabase middleware discussion](https://github.com/amannn/next-intl/discussions/422) — middleware composition pattern
- [CrunchyData — RLS for Tenants](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) — `current_setting('rls.org_id', TRUE)` policy pattern
- [Resend × Supabase integration](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase) — SMTP relay and direct API options

### Secondary (MEDIUM confidence)

- [ESLint no-restricted-imports discussion (flat config override)](https://github.com/eslint/eslint/discussions/17047) — directory-scoped override pattern verified against ESLint flat config docs
- npm registry versions verified via WebSearch 2026-05-09: drizzle-orm 0.45.2, @supabase/ssr 0.10.2, @supabase/supabase-js 2.105.3, pg 8.20.0, resend 6.12.3

### Tertiary (LOW confidence)

- `standardwebhooks` 1.0.0 — last published 2 years ago (2024); API is stable but not actively maintained; LOW confidence it has breaking changes risk, but the spec it implements (Standard Webhooks) is stable.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified against npm registry 2026-05-09
- Architecture (withSchool pattern): HIGH — verified against Drizzle official RLS docs
- RLS SQL patterns: HIGH — verified against Supabase and CrunchyData official docs
- Auth middleware composition: MEDIUM — verified via GitHub community discussion (next-intl × Supabase), not official docs
- Lockout pattern: MEDIUM — no official Supabase docs for custom lockout; pattern is standard web practice
- Pitfalls: HIGH — all pitfalls grounded in specific official doc warnings or known Postgres behavior

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable stack; Drizzle and Supabase ship frequently but APIs are stable)
