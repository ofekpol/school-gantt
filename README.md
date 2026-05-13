# School Gantt Chart System

Multi-tenant school event calendar. Staff editors submit events through a 7-step wizard → admin approves → events appear on four public views (Gantt, agenda, printable calendar, iCal). Each school is isolated via Postgres RLS. Hebrew RTL by default, English toggle available.

## Quickstart

```bash
cp .env.example .env.local       # fill in Supabase + DB urls
pnpm install
pnpm db:migrate                  # apply schema
pnpm seed                        # demo school + admin + 6 grade editors
pnpm dev                         # http://localhost:3000
```

Then sign in at `/login` with `admin@demo-school.test / ChangeMe123!` (created by the seed).

## Daily commands

```bash
pnpm dev                 # local server
pnpm tsc                 # TypeScript strict (no emit)
pnpm lint                # ESLint
pnpm test                # Vitest unit + integration
pnpm test:unit           # unit tests only (no DB needed)
pnpm test:integration    # integration tests (TEST_DATABASE_URL required)
pnpm playwright          # Playwright e2e (chromium)
pnpm build               # production build
pnpm seed:perf           # populate 1 000 events for perf benchmarks
```

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5 strict · Tailwind CSS · shadcn/ui · Supabase (Postgres + Auth + RLS) · Drizzle ORM · `next-intl` · Hand-written RFC 5545 iCal serializer · Resend · Zod · Vitest · Playwright · `@axe-core/playwright`.

## Architecture

```
app/
  (public)/                — Unauthenticated visitor surface
    page.tsx               — school index landing
    [school]/page.tsx      — Gantt (Phase 5)
    [school]/agenda/       — mobile agenda (Phase 4)
    [school]/calendar/     — printable yearly calendar (Phase 6)
  (staff)/                 — Authenticated editor surface
    dashboard/             — draft + pending list, link to rejected
    dashboard/rejected/    — rejected events with reason (Phase 3)
    events/new/            — 7-step wizard
    profile/               — iCal subscriptions (Phase 7)
  (admin)/admin/           — Admin-only
    queue/                 — pending events, approve / reject (Phase 3)
    staff/                 — manage editors
    event-types/           — color + glyph palette
    year/                  — academic year
  api/v1/                  — REST route handlers
    events/[id]/{approve,reject,revise,submit}/
    ical-subscriptions/{[id]/}
    …
  ical/[token]/route.ts    — public token-gated iCal feed (Phase 7)
lib/
  db/                      — Drizzle schema, withSchool RLS wrapper, schools/staff helpers
  auth/                    — session, admin guard, editor scopes
  events/                  — approval state machine, CRUD, queries, revisions
  ical/                    — VEVENT serializer + subscription module
  views/                   — agenda, gantt, calendar pure projections
  validations/             — Zod schemas
  i18n/                    — locale config + setLocale server action
i18n/request.ts            — next-intl request handler (cookie-based)
db/
  migrations/              — one .sql file per schema change
  seed.ts                  — demo school bootstrap (1 admin + 6 grade editors + 11 event types)
  seed-perf.ts             — 1 000-event perf seed
messages/{he,en}.json      — UI strings (he primary)
test/
  unit/                    — pure-function tests (vitest)
  integration/             — RLS + DB tests (vitest, real Postgres)
  e2e/                     — Playwright incl. a11y + PRD §14 acceptance
```

See [CLAUDE.md](./CLAUDE.md) for canonical conventions.

## Progress

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation — scaffold, RTL toolchain, CI | ✅ |
| 1 | Database, RLS, Auth — schema, withSchool, lockout | ✅ |
| 2 | Event CRUD + 7-step wizard with draft autosave | ✅ |
| 3 | Approval workflow + admin queue + revisions | ✅ |
| 4 | Public surface: FilterBar + mobile agenda | ✅ |
| 5 | Gantt view (Sept–Jul timeline, zoom presets) | ✅ |
| 6 | Printable yearly calendar + monochrome fallback | ✅ |
| 7 | iCal feed + per-staff subscriptions | ✅ |
| 8 | Polish — a11y, i18n, perf, e2e, docs | ✅ |

## Quality bars

- **Performance** — Gantt ≤ 2 s first paint with 1 k events · iCal ≤ 500 ms · public view freshness ≤ 5 s after approval
- **Accessibility** — WCAG 2.1 AA · axe-core "no serious/critical" across all four public views · 44 px tap targets · keyboard-only wizard · color + glyph encoding (color-blind safe)
- **i18n** — Hebrew default, English toggle persists in `NEXT_LOCALE` cookie · all UI strings flow through `next-intl`
- **Print** — `@media print` produces an 11-page A4 PDF · monochrome fallback (glyph + dashed border) keeps chips legible
- **Multi-tenancy** — Every query touching school data runs inside `db.withSchool(schoolId, fn)` · ESLint bans `supabaseAdmin` outside `lib/db/`
- **Coverage** — ≥ 80 % on new code · integration tests use real Postgres · e2e covers every PRD §14 acceptance criterion

## Key constraints

- All status transitions go through [lib/events/approval.ts](lib/events/approval.ts) — never set `events.status` directly
- CSS logical properties only (`start`/`end`) — never hardcode `left`/`right`
- Parameterized SQL only — no string interpolation
- Functions < 50 lines · files < 400 lines · no `any`

## Operations

See [OPERATIONS.md](./OPERATIONS.md) for Supabase setup, migrations, seeding, deployment, and runbooks.

## CI

GitHub Actions runs on every PR and push to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm tsc`
4. `pnpm test` (unit + integration)
5. `pnpm build`
6. `pnpm playwright` (chromium, with axe a11y gates)

`main` is protected — no direct pushes, CI must be green, one approving review required.
