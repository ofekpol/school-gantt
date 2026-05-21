# School Gantt Chart System

Multi-tenant school event calendar. Each school is a tenant isolated by Postgres RLS.
Staff editors submit events through a 7-step wizard → publish directly → appears on 4 public views. No admin approval required.

## Tech Stack

- Next.js 15 (App Router) + React 19 + TypeScript 5 (strict)
- Tailwind CSS + shadcn/ui + Hebrew RTL layout
- Supabase (Postgres + Auth + Row-Level Security)
- Drizzle ORM + `pg` (service-role client only inside `lib/db/`)
- `next-intl` (Hebrew + English, `he` default)
- `ical-generator` (iCal feed)
- Resend (email — invite links, password reset)
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
  (viewer)/[school]/         — Gantt (index), /calendar, /agenda (unauthenticated public)
  (staff)/                   — /dashboard, /events/new, /events/[id]/edit, /profile
  (admin)/admin/             — /staff, /event-types, /year
  api/v1/                    — REST route handlers
  ical/[token]/route.ts      — text/calendar feed (unauthenticated, token-gated)
  auth/                      — /login, /register, /confirm, /callback, /pending, /deactivated
  invite/[token]/            — Invite redemption page
lib/
  db/                        — Drizzle schema, RLS client wrapper, invites, staff, schools
  auth/                      — Session helpers (session.ts), scope checks (scopes.ts), admin (admin.ts)
  events/                    — Domain logic: create, publish, edit, revisions
  ical/                      — VEVENT serializer + filter resolver
  views/                     — Event → Gantt / calendar / agenda projections
  datetime.ts                — Timezone helpers (Asia/Jerusalem)
  validations/               — Zod schemas
  email/                     — Resend email helpers
components/                  — Shared UI; WizardStep[1..7], GanttCanvas, FilterBar, etc.
db/
  migrations/                — One .sql file per schema change
  seed.ts                    — One school + 1 admin + 6 grade editors + 11 event types
messages/
  he.json                    — Hebrew strings (primary)
  en.json                    — English strings
test/
  integration/               — RLS positive + negative cases (real Postgres)
  e2e/                       — Playwright specs
scripts/                     — Hand-written dev/ops scripts (tracked in git)
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

```text
draft → approved  (editor publishes via Step 7 — "פרסם אירוע")
approved → approved (editor edits in-place via PATCH or wizard resume)
```

The `pending` and `rejected` enum values exist in the DB schema but are **never produced**.
Every transition writes a row to `event_revisions`:

- `decision='published'` — new draft → approved
- `decision='edited'` — PATCH or re-publish of approved event

Deletes set `deleted_at` (soft delete).

## Auth

Email + password via Supabase Auth, plus Google OAuth. No custom session cookies.

Google OAuth requires the Google provider enabled in the Supabase dashboard (Client ID/Secret) with `/auth/callback` registered as a redirect URL. OAuth sign-ups land in `/auth/pending` (a `pending_registrations` row) and need admin activation; they do not auto-create an active `staff_users` row.

**Roles:** `editor` | `admin` | `viewer` (stored in `staff_users.role`)

Invite flow:

1. Admin creates invite via `lib/db/invites.ts` (token, role, grade/event-type scopes, 72h TTL)
2. Invitee opens `/invite/[token]` → registers at `/auth/register` → confirms via `/auth/confirm`
3. On confirm: `staff_users` row created, scopes applied, invite marked used

Key files:

- `lib/auth/session.ts` — `getSession()` (validates JWT via `getUser()`, never `getSession()`) and `getStaffUser()`
- `lib/auth/scopes.ts` — `assertEditorScope(user, grade?, eventType?)` — throws 403 on violation
- `lib/db/invites.ts` — invite CRUD; `getInviteByToken` uses service-role (school unknown pre-validation)

Rules:

- Admins bypass all scope checks
- Viewers can read but cannot edit (403 from `assertEditorScope`)
- Lockout: 10 failed attempts / 15 min window (tracked in `staff_users.locked_until`)
- Public routes (viewer pages, iCal): unauthenticated

## RTL / i18n

- `<html dir="rtl" lang="he">` set in root layout
- CSS: use logical properties (`start`/`end`) — never hardcode `left`/`right` in layout/position styles
- All user-visible strings through `next-intl` `t()` — no string literals in JSX
- Dates formatted via `lib/datetime.ts` using `Asia/Jerusalem` timezone — never raw `new Date()` in display code

## Key Files

| File | Purpose |
| ---- | ------- |
| `lib/db/schema.ts` | Drizzle schema — **do not modify without a new migration** |
| `lib/db/client.ts` | RLS wrapper + service-role client — only import inside `lib/db/` |
| `lib/events/approval.ts` | State machine — all status transitions here |
| `lib/auth/scopes.ts` | Scope enforcement — regression = privilege escalation |
| `lib/db/invites.ts` | Invite lifecycle — create, validate, mark used |
| `db/migrations/` | Never edit existing files; add a new file per change |
| `db/seed.ts` | Canonical school bootstrap |
| `messages/he.json` | Primary locale strings |

## Data Model (short form)

```text
schools           id, slug, name, locale, timezone, active_academic_year_id
academic_years    id, school_id, label, start_date, end_date
staff_users       id, school_id, auth_id, email, full_name, role ∈ {editor,admin,viewer}, status ∈ {pending,active,deactivated}, locked_until
staff_invites     id, school_id, token, role, grade_scopes[], event_type_scopes[], expires_at, used_at, used_by, created_by
editor_scopes     id, staff_user_id, scope_kind ∈ {grade,event_type}, scope_value
event_types       id, school_id, key, label_he, label_en, color_hex, glyph, sort_order
events            id, school_id, status ∈ {draft,approved}, version, deleted_at, ...
event_grades      event_id, grade  (composite PK)
event_revisions   id, event_id, snapshot JSONB, submitted_by, decided_by, decision ∈ {published,edited}, reason
ical_subscriptions id, staff_user_id, token, filter_grades, filter_event_types, revoked_at
audit_log         id, school_id, actor_staff_id, action, target_table, target_id, payload, at
```

## Environment Variables

```text
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

## Conventions

- API routes validate with Zod on both request and response shapes
- `withSchool(schoolId, fn)` wraps every school-scoped DB query — no exceptions
- Server Components fetch data directly; Client Components receive data as props or call `/api/v1/` routes
- New migrations go in `db/migrations/` as plain `.sql` files — never edit existing ones
- i18n keys in `messages/he.json` first, `en.json` mirror — no hardcoded strings in JSX
- Tests that touch the DB use real Postgres (no mocks); skip gracefully when DB unreachable
- Integration tests: cover RLS positive access + cross-school denial for every new table
- One-time dev/ops scripts go in `scripts/` (tracked in git)

## Git Workflow

- Never commit directly to `main`
- Branch naming: `feature/<desc>`, `fix/<desc>`, `phase/<n>-<desc>`
- For every new feature: create a new branch (`git checkout -b feature/<desc>`), work on that branch, then merge to `main` when implementation is complete (`git checkout main && git merge feature/<desc>`)
- Verify `pnpm build` passes before merging
- Keep commits atomic per logical change
- Never spawn agents with `isolation: "worktree"`.

## How Claude Should Work

- **Small task (bug fix, single file, typo):** Just do it.
- **Medium task (new component, new API route):** Make a reasonable call; flag assumptions in response.
- **Large task (new feature, new flow, auth change):** Ask 1-2 scoping questions first.
- **Testing:** Write tests for non-trivial domain logic and API routes; skip tests for simple UI wiring.
- **End of task:** One line — what changed, what's next. No summary of the diff.

## Testing Targets

- Unit + integration: Vitest, ≥ 80% coverage on new code
- Integration: real Postgres — RLS positive access + cross-school denial
- E2E: full wizard flow, publish flow, all 4 public views, iCal subscribe + revoke
- Perf: Gantt ≤ 2 s with 1 k events; iCal ≤ 500 ms

## Non-Functional Bars (hard)

- Gantt: ≤ 2 s first paint with 1 k events
- iCal feed: ≤ 500 ms response
- Public view freshness: ≤ 5 s after editor publishes (polling + 5 s `Cache-Control`)
- WCAG 2.1 AA — axe-core zero serious/critical issues
- Color + glyph encoding (color-blind safe)
- Print-legible on A3/A4 monochrome (`@media print`)

<!-- GSD:project-start source:PROJECT.md -->
## Project

School Gantt Chart System

Multi-tenant school event calendar where each school is an isolated tenant (Postgres RLS). Staff editors submit events through a 7-step wizard → publish directly (no admin approval) → events appear on 4 synchronized public views (Gantt chart, printable yearly calendar, mobile agenda, per-user iCal feed). Unauthenticated public viewers (students, parents, teachers) browse without accounts.

Core Value: An editor can publish an event and it appears publicly across all views within 5 seconds.

### Constraints

- **Tech Stack:** Next.js 15 App Router + React 19 + TypeScript 5 strict; Tailwind + shadcn/ui; Supabase (Postgres + Auth + RLS); Drizzle ORM + `pg`; `next-intl`; `ical-generator`; Resend; Zod; Vitest + Playwright
- **RTL:** CSS logical properties only (`start`/`end`) — never hardcode `left`/`right` in layout/position styles
- **DB safety:** Every query touching school data must use `db.withSchool(schoolId, fn)`. ESLint rule bans raw service client outside `lib/db/`
- **Security:** Parameterized SQL only; no SQL string interpolation; `supabaseAdmin` only inside `lib/db/`
- **Auth lockout:** 10 failed attempts / 15 min window
- **Performance:** Gantt ≤ 2 s first paint (1k events); iCal ≤ 500 ms; public view freshness ≤ 5 s after publish
- **Coverage:** ≥ 80% on new code; integration tests use real Postgres (no mocks)
- **Code style:** Functions < 50 lines; files < 400 lines; no `any`; `snake_case` DB → `camelCase` frontend transformed at API layer
<!-- GSD:project-end -->
