---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Completed 02-04-PLAN.md: admin UI pages (staff, event-types, year)"
last_updated: "2026-05-12T18:58:07.649Z"
last_activity: 2026-05-12
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 13
  completed_plans: 13
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09)

**Core value:** An admin can approve a staff-submitted event and it appears publicly across all views within 5 seconds.
**Current focus:** Phase 2 — Event CRUD & 7-Step Wizard

## Current Position

Phase: 2 (Event CRUD & 7-Step Wizard) — EXECUTING
Plan: 2 of 5
Status: Ready to execute
Last activity: 2026-05-12

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: 5 min
- Total execution time: 0.08 h

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 00-foundation | 1/3 | 5 min | 5 min |

**Recent Trend:**

- Last 5 plans: 5 min (00-01)
- Trend: —

*Updated after each plan completion*

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| Phase 00-foundation | P01 | 5 min | 3 tasks | 15 files |
| Phase 00-foundation P02 | 25 | 4 tasks | 19 files |
| Phase 00-foundation P02 | 45 | 5 tasks | 19 files |
| Phase 00-foundation P03 | 2 | 2 tasks | 2 files |
| Phase 00-foundation P03 | 30 | 3 tasks | 3 files |
| Phase 01-database-rls-auth P00 | 3 | 2 tasks | 10 files |
| Phase 01-database-rls-auth P01 | 5 | 3 tasks | 11 files |
| Phase 01-database-rls-auth P02 | 68 | 2 tasks | 11 files |
| Phase 01-database-rls-auth P03 | 17 | 3 tasks | 14 files |
| Phase 01-database-rls-auth P04 | 11 | 3 tasks | 5 files |
| Phase 02-event-crud-7-step-wizard P04 | 45 | 3 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Custom SVG/Canvas for Gantt (C1) — no off-shelf lib handles RTL + multi-grade spanning bars
- Init: CSS `@media print` for PDF (D1) — no server-side rendering needed
- Init: Polling + 5 s Cache-Control for ≤ 5 s freshness (E1)
- Init: shadcn RTL patches needed for Popover, Calendar, Dropdown — budget half-day in Phase 0
- [Phase 00-foundation]: typedRoutes moved to top-level in next.config.ts — Next.js 15.5 moved it from experimental
- [Phase 00-foundation]: CSS logical properties pattern established: use ms-*/me-*/ps-*/pe-*/text-start/text-end for RTL, never left/right
- [Phase 00-foundation]: Server Components by default — no 'use client' unless hooks or browser APIs are needed
- [Phase 00-foundation]: shadcn v4 uses Base UI not Radix - RTL is handled natively via dir attribute
- [Phase 00-foundation]: Tailwind v3 upgraded to v4 (required by shadcn v4 components)
- [Phase 00-foundation]: app/dev/rtl-showcase (not _dev/) - Next.js App Router excludes _-prefixed folders from routing
- [Phase 00-foundation]: shadcn v4 (4.7.0) installs @base-ui/react (Base UI) instead of Radix — handles RTL natively via dir attribute, fewer CSS patches needed
- [Phase 00-foundation]: Tailwind v3 upgraded to v4 (required by shadcn v4); @tailwindcss/postcss replaces tailwindcss in postcss config; CSS config now uses @import + @theme inline tokens
- [Phase 00-foundation]: D-03: CI triggers on pull_request (any branch) and push to main; feature-branch pushes without PR do not trigger CI
- [Phase 00-foundation]: D-05: CI pipeline order is lint → typecheck → unit tests → build → e2e; added build step to catch Next.js production-only issues
- [Phase 00-foundation]: Job name 'Lint, Typecheck, Test, E2E' is the required GitHub status check name — renaming requires updating branch protection
- [Phase 00-foundation]: D-04 confirmed: main branch protection active — CI green + 1 review required; direct push to main blocked
- [Phase 00-foundation]: Node bumped to 22 LTS (from 20.11.0) — rolldown/Vitest 4 requires node:util styleText (Node>=20.12); 22 LTS is the safe floor
- [Phase 01-database-rls-auth]: Vitest projects array chosen over separate config files — single config, two named project contexts (unit/jsdom + integration/node)
- [Phase 01-database-rls-auth]: it.todo() used for test stubs — pending tests appear in coverage map without causing CI failures
- [Phase 01-database-rls-auth]: skipIfNoTestDb guard in integration setup — tests skip gracefully when TEST_DATABASE_URL absent; TEST_DATABASE_URL left empty (Option C) until Plan 04 AUTH-03 lockout tests require it
- [Phase 01-database-rls-auth]: staffUsers.id mirrors auth.users.id (no defaultRandom) — seed sets UUID explicitly from Supabase Auth
- [Phase 01-database-rls-auth]: schoolIsolation pgPolicy defined once as shared const, referenced in 9 table callbacks — DRY RLS policy pattern
- [Phase 01-database-rls-auth]: Migration named 0000_initial.sql (drizzle-kit default); 0001 reserved for next schema change. NOT yet applied — Plan 02 applies it.
- [Phase 01-database-rls-auth]: withSchool uses SET LOCAL ROLE authenticated inside transaction — postgres bypassrls=true skips RLS; authenticated role has bypassrls=false so policies apply
- [Phase 01-database-rls-auth]: FORCE ROW LEVEL SECURITY applied via 0001 migration — does not override bypassrls but required for non-bypassrls connections and correctness documentation
- [Phase 01-database-rls-auth]: Seed uses withSchool for school-scoped inserts (schools table inserted directly, no RLS); dotenv loads .env.local explicitly in supabase-admin.ts due to CJS hoisting
- [Phase 01-database-rls-auth]: getSession() uses auth.getUser() not auth.getSession() — Pitfall 2: server-side JWT validation vs local cookie read
- [Phase 01-database-rls-auth]: Cross-school staff lookup in lib/db/staff.ts (not lib/auth/) — preserves ESLint ban on service-role client outside lib/db/
- [Phase 01-database-rls-auth]: server-only mocked as no-op in vitest unit test alias — real guard active in Next.js runtime; jsdom crashes without the mock
- [Phase 01-database-rls-auth]: Middleware short-circuits on i18n redirects (3xx) before Supabase session refresh — avoids cookie mutation during locale redirects
- [Phase 01-database-rls-auth]: vi.mock for next/headers + createSupabaseServerClient in integration tests isolates auth transport from DB logic without full Next.js server
- [Phase 01-database-rls-auth]: RESEND_API_KEY=placeholder: reset-password route fully implemented; Resend SMTP relay config and email delivery deferred to Phase 8
- [Phase 02-event-crud-7-step-wizard]: redirect('/') not redirect('/login') in admin layout — typedRoutes rejects non-existent routes; consistent with staff layout pattern
- [Phase 02-event-crud-7-step-wizard]: Admin page pattern: Server Component loads data via domain helper → Client Component handles mutations via fetch + router.refresh()

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 0: shadcn RTL patch scope unknown until components are tested in Hebrew layout
- Phase 1: Hebrew password-reset email deliverability requires SPF/DKIM/DMARC setup
- Phase 5: Gantt perf at >2k DOM nodes may require Canvas virtualization — validate early in Phase 5

## Session Continuity

Last session: 2026-05-12T18:58:07.634Z
Stopped at: Completed 02-04-PLAN.md: admin UI pages (staff, event-types, year)
Resume file: None
