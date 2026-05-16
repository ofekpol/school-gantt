# School Gantt Chart System

Multi-tenant school event calendar. Each school is a tenant isolated by Postgres RLS.
Staff editors submit events through a 7-step wizard → admin approves → appears on 4 public views.

## Tech Stack

- Next.js 15 (App Router) + React 19 + TypeScript 5 (strict)
- Tailwind CSS + shadcn/ui + Hebrew RTL layout
- Supabase (Postgres + Auth + Row-Level Security)
- Drizzle ORM + `pg` (service-role client only inside `lib/db/`)
- `next-intl` (Hebrew + English, `he` default)
- `ical-generator` (iCal feed)
- Resend (email — password reset, rejection notifications)
- Zod (all API boundary validation)
- Vitest (unit + integration) + Playwright (e2e)

## Commands

```bash
pnpm dev              # Dev server (localhost:3000)
pnpm build            # Production build — verify before committing
pnpm lint             # ESLint
pnpm tsc --noEmit     # Type check without emitting
pnpm test             # Vitest unit + integration tests
pnpm test:coverage    # Vitest with coverage report
pnpm playwright test  # Playwright e2e suite
```

## Architecture

```
app/
  (public)/[school]/           — Gantt (index), /calendar, /agenda
  (staff)/                     — /dashboard, /events/new, /events/[id]/edit, /profile
  (admin)/admin/               — /queue, /staff, /event-types, /year
  api/v1/                      — REST route handlers
  ical/[token]/route.ts        — text/calendar feed (unauthenticated, token-gated)
lib/
  db/                          — Drizzle schema, RLS client wrapper
  auth/                        — Session helpers, scope checks
  events/                      — Domain logic: create, submit, approve, reject, revisions
  ical/                        — VEVENT serializer + filter resolver
  views/                       — Event → Gantt / calendar / agenda projections
  datetime.ts                  — Timezone helpers (Asia/Jerusalem)
  validations/                 — Zod schemas
components/                    — Shared UI; WizardStep[1..7], GanttCanvas, FilterBar, etc.
db/
  migrations/                  — One .sql file per schema change
  seed.ts                      — One school + 1 admin + 6 grade editors + 11 event types
messages/
  he.json                      — Hebrew strings (primary)
  en.json                      — English strings
test/
  integration/                 — RLS positive + negative cases (real Postgres)
  e2e/                         — Playwright specs
```

## Multi-Tenancy (Critical)

Every query that touches school data **must** run inside `db.withSchool(schoolId, fn)`.
This helper sets `app.school_id` so Postgres RLS policies activate.

```ts
// CORRECT
const events = await db.withSchool(schoolId, () => db.query.events.findMany(...));

// WRONG — bypasses RLS, leaks cross-school data
const events = await supabaseAdmin.from('events').select('*');
```

`supabaseAdmin` (service-role client) lives in `lib/db/client.ts` only.
An ESLint rule bans importing it outside `lib/db/`.

## Event State Machine

All status transitions go through `lib/events/approval.ts`. Never set `events.status` directly.

```
draft → pending   (editor submits via Step 7)
pending → approved (admin approves)
pending → rejected (admin rejects with reason)
rejected → pending (editor revises + resubmits)
approved + edit   → approved (v1, public) + new pending revision (v2, hidden)
admin creates/edits → auto-approved
```

Every transition writes a row to `event_revisions`. Deletes set `deleted_at` (soft delete).

## Auth

Supabase Auth (email + password). No custom session cookies.
- `lib/auth/session.ts` — `getSession()` server helper
- `lib/auth/scopes.ts` — `assertEditorScope(user, grade?, eventType?)` — throws 403 on violation
- Admins: `role='admin'` in `staff_users`. Public routes: unauthenticated.
- Lockout: 10 failed attempts / 15 min window.

## RTL / i18n

- `<html dir="rtl" lang="he">` set in root layout
- CSS: use logical properties (`start`/`end`) — never hardcode `left`/`right` in layout/position styles
- All user-visible strings through `next-intl` `t()` — no string literals in JSX
- Dates formatted via `lib/datetime.ts` using `Asia/Jerusalem` timezone — never raw `new Date()` in display code
- shadcn Popover, Calendar, Dropdown: RTL patches required (budget in Phase 0)

## Key Files

| File | Purpose |
|------|---------|
| `lib/db/schema.ts` | Drizzle schema — **do not modify without a new migration** |
| `lib/db/client.ts` | RLS wrapper + service-role client — only import inside `lib/db/` |
| `lib/events/approval.ts` | State machine — all status transitions here |
| `lib/auth/scopes.ts` | Scope enforcement — regression = privilege escalation |
| `db/migrations/` | Never edit existing files; add a new file per change |
| `db/seed.ts` | Canonical school bootstrap |
| `messages/he.json` | Primary locale strings |

## Data Model (short form)

```
schools           id, slug, name, locale, timezone, active_academic_year_id
academic_years    id, school_id, label, start_date, end_date
staff_users       id, school_id, email, full_name, role ∈ {editor,admin}, locked_until
editor_scopes     id, staff_user_id, scope_kind ∈ {grade,event_type}, scope_value
event_types       id, school_id, key, label_he, label_en, color_hex, glyph, sort_order
events            id, school_id, status ∈ {draft,pending,approved,rejected}, version, deleted_at, ...
event_grades      event_id, grade  (composite PK)
event_revisions   id, event_id, snapshot JSONB, submitted_by, decided_by, decision, reason
ical_subscriptions id, staff_user_id, token, filter_grades, filter_event_types, revoked_at
audit_log         id, school_id, actor_staff_id, action, target_table, target_id, payload, at
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
NEXT_PUBLIC_APP_URL
```

Never commit these.

## Code Style

- Strict TypeScript — no `any`
- Zod schema at every API boundary (request in + response out)
- `snake_case` DB columns → `camelCase` frontend types; transform at the API route layer
- `"use client"` only when hooks or browser APIs are used — Server Components by default
- `cn()` from `lib/utils.ts` for className merging
- Icons from `lucide-react` only
- Parameterized queries only — no SQL string interpolation
- Functions < 50 lines, files < 400 lines

## Git Workflow

- Never commit directly to `main`
- Branch naming: `feature/<desc>`, `fix/<desc>`, `phase/<n>-<desc>`
- For every new feature: create a new branch (`git checkout -b feature/<desc>`), work on that branch, then merge to `main` when implementation is complete (`git checkout main && git merge feature/<desc>`)
- Verify `pnpm build` passes before merging
- Keep commits atomic per logical change
- Never spawn agents with `isolation: "worktree"`.

## Testing Targets

- Unit + integration: Vitest, ≥ 80% coverage on new code
- Integration: real Postgres — RLS positive access + cross-school denial
- E2E: full wizard flow, approval flow, all 4 public views, iCal subscribe + revoke
- Perf: Gantt ≤ 2 s with 1 k events; iCal ≤ 500 ms

## Non-Functional Bars (hard)

- Gantt: ≤ 2 s first paint with 1 k events
- iCal feed: ≤ 500 ms response
- Public view freshness: ≤ 5 s after admin approves (polling + 5 s `Cache-Control`)
- WCAG 2.1 AA — axe-core zero serious/critical issues
- Color + glyph encoding (color-blind safe)
- Print-legible on A3/A4 monochrome (`@media print`)

<!-- GSD:project-start source:PROJECT.md -->
## Project

**School Gantt Chart System**

Multi-tenant school event calendar where each school is an isolated tenant (Postgres RLS). Staff editors submit events through a 7-step wizard → school admin approves or rejects → events appear on 4 synchronized public views (Gantt chart, printable yearly calendar, mobile agenda, per-user iCal feed). Unauthenticated public viewers (students, parents, teachers) browse without accounts.

**Core Value:** An admin can approve a staff-submitted event and it appears publicly across all views within 5 seconds.

### Constraints

- **Tech Stack:** Next.js 15 App Router + React 19 + TypeScript 5 strict; Tailwind + shadcn/ui; Supabase (Postgres + Auth + RLS); Drizzle ORM + `pg`; `next-intl`; `ical-generator`; Resend; Zod; Vitest + Playwright
- **RTL:** CSS logical properties only (`start`/`end`) — never hardcode `left`/`right` in layout/position styles
- **DB safety:** Every query touching school data must use `db.withSchool(schoolId, fn)`. ESLint rule bans raw service client outside `lib/db/`
- **Security:** Parameterized SQL only; no SQL string interpolation; `supabaseAdmin` only inside `lib/db/`
- **Auth lockout:** 10 failed attempts / 15 min window
- **Performance:** Gantt ≤ 2 s first paint (1k events); iCal ≤ 500 ms; public view freshness ≤ 5 s after approval
- **Coverage:** ≥ 80% on new code; integration tests use real Postgres (no mocks)
- **Code style:** Functions < 50 lines; files < 400 lines; no `any`; `snake_case` DB → `camelCase` frontend transformed at API layer
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
