# Operations

End-to-end runbook for setting up, deploying, and operating the School Gantt Chart System.

## 1. Environment variables

Copy `.env.example` to `.env.local` and fill these in:

| Variable | Purpose | Where it's used |
|----------|---------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | client + middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (admin operations) | `lib/db/supabase-admin.ts` only |
| `DATABASE_URL` | Postgres connection, preferably Supabase pooler for IPv4-only local/runtime networks (used by Drizzle migrations + the `db` pool) | `lib/db/client.ts` |
| `TEST_DATABASE_URL` | Separate Postgres for integration tests; tests skip if absent | `test/integration/setup.ts` |
| `RESEND_API_KEY` | Resend API key for approval notifications | `lib/email/approval.ts` |
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `https://school-gantt.example`) | reset-password email link |

Never commit `.env.local`. The `.env.example` file is the canonical list of expected variables.

> ⚠️ **Never point integration tests at prod.** `DATABASE_URL` and `TEST_DATABASE_URL` must resolve to different Supabase projects. Vitest specs under `test/integration/` create events, academic years, invites, etc. without teardown — running them against prod pollutes the public viewer. If you need to clean up prior pollution, see `scripts/cleanup-e2e-pollution.sql` (dry-run by default; export `CONFIRM=1` to commit).

## 2. Supabase setup (one-time per tenant)

1. Create a new Supabase project.
2. In **Authentication → Email**, disable "Confirm email" for local dev OR set up SMTP for production.
3. Copy the project URL + anon key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Copy the service-role key into `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose).
5. Copy a Postgres URL into `DATABASE_URL`:
   - Prefer **Project Settings → Database → Connection pooling → URI** for local development and IPv4-only hosts. Supabase direct DB hosts are often IPv6-only.
   - Direct URLs from **Connection String → URI** are fine only when the runtime has IPv6 connectivity.

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

### Environments

| Env | Git branch | URL | Supabase project |
|-----|-----------|-----|------------------|
| Production | `main` | `school-gantt.vercel.app` | `school-gantt-production` (`mfrtdirkknuvweaiqfzs`) |
| Staging | `staging` | `school-gantt-git-staging-ofekpols-projects.vercel.app` (Vercel login required) | `school-gantt-staging` (`wmapfuwpdyishfqtzwha`, eu-central-1) |
| Branch previews | any other | `school-gantt-git-<branch>-ofekpols-projects.vercel.app` | same as staging |

Vercel **Preview** env vars point at the staging project. `RESEND_API_KEY` and `NEXT_PUBLIC_APP_URL` are deliberately unset on Preview: no emails are sent, and links use the request origin.

**Promotion flow:** feature branch → PR into `staging` → verify on the staging URL → PR `staging` → `main`. A hotfix merged straight into `main` must be merged back into `staging`.

**Data refresh (manual):** `.github/workflows/refresh-staging-db.yml` copies prod's `public` schema plus `auth.users`/`auth.identities` into staging via `scripts/refresh-staging-db.sh` and re-applies staging-only migrations. It does not run on a schedule, so anything created on staging survives until the next refresh. Run it:

```bash
gh workflow run refresh-staging-db.yml --ref staging
```

Required GitHub secrets: `PROD_DATABASE_URL`, `STAGING_DATABASE_URL` (Supabase **session pooler** URIs — runners are IPv4-only). The script only reads from prod and refuses any target that isn't the staging project.

**Demo school on staging (optional):** staging is a copy of prod, so debug against the copied prod school directly. A refresh wipes any `demo-school` tenant. Seed it again only when you need the role-specific test logins (admin, grade editors, counselor, viewer). Point `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` at the **staging** project, then:

```bash
pnpm seed
```

`db/seed.ts` refuses any database or Supabase project that isn't local or staging. Demo logins are the seed accounts listed under "Default credentials after `pnpm seed`" above (forced password change on first login).

**Second school on staging:** for manual cross-school checks, provision one with `scripts/provision-school.ts` against staging (the onboarding rehearsal, see "Onboarding checklist for a new school"). Redo it after each refresh. Automated isolation coverage doesn't depend on staging: the integration suite uses its own two test schools, and `test/e2e/multi-school.spec.ts` creates its own `second-school`.

Running `pnpm test:integration` with `TEST_DATABASE_URL` pointed at staging leaves test rows on staging until the next refresh.

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

## 12. Provisioning a new school (production tenant)

For real (non-demo) schools, use `scripts/provision-school.ts` rather than the seed. The CLI creates the `schools` row, the 11 default `event_types`, and a Supabase Auth + `staff_users` admin record, then generates a one-time magic-link email via Resend. No academic year is needed: the public views derive their date range from the school's events.

```bash
pnpm provision:school \
  --slug=kfar-galim \
  --name="כפר גלים" \
  --admin-email=admin@example.com \
  --admin-name="ישראל ישראלי"
```

Flags:

| Flag | Required | Notes |
|------|----------|-------|
| `--slug` | yes | URL segment; `^[a-z0-9-]+$` |
| `--name` | yes | Display name (Hebrew OK) |
| `--admin-email` | yes | First admin's real email. Must not already be staff in another school (one login = one school) |
| `--admin-name` | yes | First admin's full name |
| `--locale` | no | `he` (default) or `en` |
| `--timezone` | no | default `Asia/Jerusalem` |
| `--skip-email` | no | Print magic link to stdout instead of sending via Resend |

Required env vars at run time: `DATABASE_URL` (prod pooler), `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, and (unless `--skip-email`) `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.

Behavior:

- Conflict on existing slug → exits 1 with `school with slug "..." already exists — refusing to clobber`.
- Admin Supabase Auth user is created **without a password** — first sign-in is via the emailed magic link (1 h expiry, Supabase default).
- After first sign-in the admin invites further staff via `/admin/staff` (the standard invite flow); the CLI never creates editors directly.

### Onboarding checklist for a new school

Rehearse on staging first (point the env at staging); the next manual staging refresh wipes it.

1. `pnpm provision:school --slug=<slug> --name=... --admin-email=... --admin-name=...` with prod env loaded.
2. The admin signs in through the magic link and reviews `/admin/event-types`.
3. Give the school two links:
   - Staff sign-up: `https://<app>/auth/login?school=<slug>`. Google or email sign-ups through it land in **that** school's pending list (`/admin/staff`). Sign-ups without the link have no school and no admin sees them. Invites (`/admin/staff`) work regardless.
   - Public schedule: `https://<app>/<slug>` (full viewer) or `https://<app>/schedule?school=<slug>` (read-only). With 2+ schools, plain `/schedule` shows a school picker.
4. Smoke-check `/<slug>`, `/<slug>/calendar`, `/<slug>/agenda` after the first event is published.

Production cutover (one-time, per new Supabase project):

1. Create the prod Supabase project; copy URL + anon + service-role keys + pooler `DATABASE_URL`.
2. Update Vercel **Production** env vars to point at the prod Supabase. Keep **Preview** scope pointed at the dev Supabase.
3. Apply migrations: `DATABASE_URL=<prod-pooler-url> pnpm db:migrate`.
4. Run `pnpm provision:school …` with prod env loaded.
5. `vercel --prod` to redeploy with the new env.

## 13. Versioning + releases

The repo is single-tenant per Vercel project — production state lives in the linked Supabase project. There is no separate version number. Schema migrations are forward-only.
