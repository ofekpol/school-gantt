# Operations

End-to-end runbook for setting up, deploying, and operating the School Gantt Chart System.

## 1. Environment variables

Copy `.env.example` to `.env.local` and fill these in:

| Variable | Purpose | Where it's used |
|----------|---------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | client + middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (admin operations) | `lib/db/supabase-admin.ts` only |
| `DATABASE_URL` | Direct Postgres connection (used by Drizzle migrations + the `db` pool) | `lib/db/client.ts` |
| `TEST_DATABASE_URL` | Separate Postgres for integration tests; tests skip if absent | `test/integration/setup.ts` |
| `RESEND_API_KEY` | Resend API key for password-reset email | `app/api/v1/auth/reset-password/` |
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `https://school-gantt.example`) | reset-password email link |

Never commit `.env.local`. The `.env.example` file is the canonical list of expected variables.

## 2. Supabase setup (one-time per tenant)

1. Create a new Supabase project.
2. In **Authentication → Email**, disable "Confirm email" for local dev OR set up SMTP for production.
3. Copy the project URL + anon key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Copy the service-role key into `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose).
5. Copy the direct Postgres URL (Project Settings → Database → Connection String → URI) into `DATABASE_URL`.

## 3. Migrations

Schema lives in `lib/db/schema.ts`. To apply schema changes:

```bash
pnpm db:generate        # writes a new .sql file to db/migrations/
pnpm db:migrate         # applies pending migrations against DATABASE_URL
```

Migration files are immutable once committed — add a new file rather than editing existing ones.

The initial migrations (`0001_init.sql..0010_*.sql`) also install the `school_isolation` RLS policy and the `authenticated` role that `withSchool` switches into. Re-running `db:migrate` on a fresh Supabase project bootstraps everything.

## 4. Seeding

```bash
pnpm seed              # demo school + admin + 6 grade editors + counselor + 11 event types
pnpm seed:perf         # adds 1 000 approved events spread across the active year
```

Seed is idempotent: re-running upserts the demo rows without duplicating.

Default credentials after `pnpm seed`:

| User | Email | Password |
|------|-------|----------|
| Admin | `admin@demo-school.test` | `ChangeMe123!` |
| Grade 7-12 editors | `grade7@demo-school.test` … `grade12@…` | `ChangeMe123!` |
| Counselor (event-type scope) | `counselor@demo-school.test` | `ChangeMe123!` |

Change these immediately in a non-dev environment.

## 5. Running tests

| Command | What it runs | Needs DB? |
|---------|--------------|-----------|
| `pnpm test:unit` | Vitest pure-function tests | no |
| `pnpm test:integration` | Vitest RLS + DB-bound tests | yes (`TEST_DATABASE_URL`) |
| `pnpm test` | Both projects | no (DB-bound suites skip if `TEST_DATABASE_URL` is unset) |
| `pnpm playwright` | Playwright e2e + axe a11y | partial (most suites skip without `DATABASE_URL`) |

For a true full run, start a dev server against a seeded test DB, then `pnpm playwright`. The `pnpm seed:perf` step is required for `test/e2e/perf.spec.ts`.

## 6. Local development

```bash
pnpm dev               # http://localhost:3000
```

Useful URLs once the demo seed is in place:

- `/` — school index landing
- `/demo-school` — Gantt view
- `/demo-school/agenda` — mobile agenda
- `/demo-school/calendar` — printable yearly calendar
- `/login` — sign in
- `/dashboard` — editor home (after sign in)
- `/admin/queue` — approval queue (admin only)
- `/profile` — iCal subscriptions

## 7. Deployment (Vercel)

```bash
vercel deploy --prod
```

Required project settings:

1. **Environment variables** — paste each variable from `.env.example` into Vercel project settings (production + preview environments separately).
2. **Build command** — `pnpm build` (the default).
3. **Output** — Next.js (auto-detected). Middleware runs on Edge.
4. **Region** — pick a region close to the Supabase project to minimize round-trip latency for `withSchool` transactions.

## 8. Monitoring & SLOs

The PRD targets and the corresponding observables:

| Target | Where to watch |
|--------|---------------|
| Gantt ≤ 2 s first paint with 1 k events | Vercel "Speed Insights" or Lighthouse run against `/[school]?cb=1` |
| iCal feed ≤ 500 ms response | Vercel function logs (`/ical/[token]`) p95 |
| Public view freshness ≤ 5 s after admin approval | Manual: approve → reload `/[school]/agenda` |
| Token revocation visible ≤ 60 s | `Cache-Control: max-age=60` on `/ical/[token]` |
| WCAG 2.1 AA — zero serious/critical | `pnpm playwright` running `test/e2e/a11y.spec.ts` |
| Auth lockout — 10 attempts / 15 min | `staff_users.locked_until` updates |

## 9. Runbooks

### "An editor can't sign in — claims password is right"

Check `staff_users.locked_until`. If set in the future, lockout is active (10 failed attempts in the prior 15 min). Either wait it out or zero the column:

```sql
UPDATE staff_users SET locked_until = NULL, login_attempts = 0 WHERE email = '...';
```

### "An admin approved an event but it's not showing up publicly"

Check that the public view URL doesn't have a stale ISR cache. Public routes use `revalidate = 5`, so the new version is at most 5 s away. Add `?cb=$(date +%s)` to force a fresh render.

If a revision (parent_event_id) was approved, `lib/events/approval.ts:approveEvent` soft-deletes the parent in the same transaction. If both rows are visible, that transaction failed — check Postgres logs.

### "Someone needs to revoke an iCal token in a hurry"

Either through `/profile` (the owning staff user) or directly:

```sql
UPDATE ical_subscriptions SET revoked_at = NOW() WHERE token = '...';
```

The public feed `Cache-Control: max-age=60` means a Google Calendar refresh within ~1 min will see 404.

### "We need a new academic year"

1. Sign in as admin.
2. Visit `/admin/year`.
3. Create the year row.
4. Click "Set as active". Subsequent wizard date-pickers will bound to the new year.

Events from the previous year remain readable but read-only.

## 10. Security notes

- `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` grant unrestricted DB access — never expose in client bundles, never log.
- The `db` client (`lib/db/client.ts`) imports `supabaseAdmin` and bypasses RLS. ESLint bans importing `supabaseAdmin` outside `lib/db/` (overridden under `lib/db/**`, `db/seed.ts`, and `db/migrations/`).
- Every school-data query must run inside `db.withSchool(schoolId, fn)`. Two known exceptions live in `lib/db/schools.ts` (slug lookup) and `lib/ical/subscriptions.ts` (token lookup) — both are keyed on a cryptographically-scoped value, document the why inline, and never read another tenant's data.
- All status transitions go through `lib/events/approval.ts`. Never set `events.status` directly in a route handler.

## 11. Versioning + releases

The repo is single-tenant per Vercel project — production state lives in the linked Supabase project. There is no separate version number. Schema migrations are forward-only.
