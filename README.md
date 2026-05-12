# School Gantt Chart System

Multi-tenant school event calendar. Staff editors submit events through a 7-step wizard → admin approves → events appear on 4 public views (Gantt, agenda, printable calendar, iCal). Each school is isolated via Postgres RLS. Hebrew RTL by default.

## Quickstart

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm tsc --noEmit # TypeScript check
pnpm lint         # ESLint
pnpm test         # Vitest unit + integration
pnpm playwright test  # Playwright e2e
```

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5 strict · Tailwind CSS · shadcn/ui · Supabase (Postgres + Auth + RLS) · Drizzle ORM · next-intl · ical-generator · Resend · Zod · Vitest · Playwright

## Architecture

```
app/
  (public)/[school]/     — Gantt (index), /calendar, /agenda
  (staff)/               — /dashboard, /events/new, /events/[id]/edit, /profile
  (admin)/admin/         — /queue, /staff, /event-types, /year
  api/v1/                — REST route handlers
  ical/[token]/route.ts  — text/calendar feed (token-gated, unauthenticated)
lib/
  db/                    — Drizzle schema, RLS client wrapper (withSchool)
  auth/                  — Session helpers, scope checks
  events/                — Domain logic: create, submit, approve, reject, revisions
  ical/                  — VEVENT serializer + filter resolver
  views/                 — Event → Gantt / calendar / agenda projections
  datetime.ts            — Timezone helpers (Asia/Jerusalem)
  validations/           — Zod schemas
components/              — Shared UI; WizardStep[1..7], GanttCanvas, FilterBar, etc.
db/
  migrations/            — One .sql file per schema change
  seed.ts                — One school + 1 admin + 6 grade editors + 11 event types
messages/
  he.json                — Hebrew strings (primary)
  en.json                — English strings
test/
  integration/           — RLS positive + negative cases (real Postgres)
  e2e/                   — Playwright specs
```

See `CLAUDE.md` for canonical conventions.

## Progress

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation — repo scaffold, RTL toolchain, CI | ✅ Complete (2026-05-08) |
| 1 | Database, RLS & Auth — schema, migrations, withSchool, auth routes, lockout | ✅ Complete (2026-05-10) |
| 2 | Event CRUD & 7-Step Wizard | Not started |
| 3 | Approval Workflow | Not started |
| 4 | Filter Bar & Agenda View | Not started |
| 5 | Gantt View | Not started |
| 6 | Printable Yearly Calendar | Not started |
| 7 | iCal Feed & Subscriptions | Not started |
| 8 | Polish & QA | Not started |

Full roadmap: `.planning/ROADMAP.md`

## Key Constraints

- Every school-data query must use `db.withSchool(schoolId, fn)` — ESLint bans raw service client outside `lib/db/`
- All status transitions go through `lib/events/approval.ts` — never set `events.status` directly
- CSS logical properties only (`start`/`end`) — never hardcode `left`/`right`
- Parameterized SQL only — no string interpolation
- Functions < 50 lines · files < 400 lines · no `any`

## CI

GitHub Actions runs on every PR and every push to `main`.

### Pipeline

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` — ESLint
3. `pnpm tsc --noEmit` — TypeScript strict
4. `pnpm test` — Vitest unit + integration
5. `pnpm build` — Next.js production build
6. `pnpm playwright test` — Playwright e2e (chromium)

First failing step aborts. Playwright report uploaded as artifact on failure.

### Branch Protection

`main` is protected — no direct pushes, CI must be green, 1 approving review required.

See `.github/workflows/ci.yml` for the workflow definition.
