# Phase 1: Database, RLS & Auth - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the full data layer and authentication foundation:
- Drizzle schema matching all PRD tables (`lib/db/schema.ts`)
- Postgres RLS policies enforcing `app.school_id` isolation on every school-scoped table
- `db.withSchool(schoolId, fn)` wrapper that sets the RLS session variable
- ESLint rule banning `supabaseAdmin` imports outside `lib/db/`
- Seed script: one school, one admin, six grade-supervisor editors (grades 7–12), one department editor (counselor), 11 default event types
- Supabase Auth: email+password login, password reset (Resend), 10-attempt lockout, `getSession()` server helper, `assertEditorScope()` scope checks, public route passthrough

This phase delivers zero UI. Success is verified programmatically (integration tests + seed script run).

</domain>

<decisions>
## Implementation Decisions

### Supabase Project

- **D-01:** Supabase project already provisioned — executor connects to the existing project. No `supabase init`, no project creation step.
- **D-02:** `.env.local` credentials are NOT yet filled in. Executor must pause at a `checkpoint:human-action` early in execution to collect:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  Before proceeding to run migrations or seed. Do NOT attempt to connect to Supabase before the user has supplied the keys.

### Claude's Discretion

- **Password reset + Resend integration** — Claude chooses the Resend wiring approach for AUTH-02 (SMTP relay, edge function, or direct Next.js API route calling Resend SDK). Prefer the approach that keeps the implementation inside Next.js routes rather than Supabase edge functions, to stay within the project's tech boundary.
- **Auth route protection** — Claude decides between blanket `middleware.ts` for staff/admin routes vs per-layout `getSession()` checks. Either is acceptable; prefer whatever integrates cleanly with Next.js App Router layout hierarchy.
- **Failed-login lockout** — Claude implements AUTH-03 using the `staff_users.locked_until` column (already in schema). Track attempt count + expiry in the DB; Supabase Auth rate limiting is a secondary safeguard, not the primary enforcement mechanism.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Data Model
- `CLAUDE.md` §"Data Model (short form)" — all table definitions with columns and types (canonical)
- `PRD_school_gantt_chart_system.md` §6 — full PRD schema (extended column details, relationships, seed data)

### Requirements
- `.planning/REQUIREMENTS.md` — DB-01 through DB-06 and AUTH-01 through AUTH-07 are the acceptance criteria for this phase

### Stack & Constraints
- `CLAUDE.md` §"Multi-Tenancy (Critical)" — `withSchool()` pattern, why `supabaseAdmin` is banned outside `lib/db/`, RLS session variable name
- `CLAUDE.md` §"Auth" — `getSession()`, `assertEditorScope()`, lockout policy, public route rules
- `CLAUDE.md` §"Key Files" — canonical paths: `lib/db/schema.ts`, `lib/db/client.ts`, `lib/auth/session.ts`, `lib/auth/scopes.ts`, `db/migrations/`, `db/seed.ts`
- `.planning/PROJECT.md` — tech stack constraints (Supabase Auth, Drizzle ORM + `pg`, Resend)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/utils.ts` — `cn()` helper (shadcn); not directly relevant to Phase 1 but the `lib/` directory is the correct home for `lib/db/` and `lib/auth/`

### Established Patterns
- Phase 0 established: `"use client"` only when hooks/browser APIs needed; Server Components by default
- Phase 0 established: Tailwind v4 + `@base-ui/react` (shadcn v4) — no Radix primitives
- Phase 1 establishes the foundational patterns all later phases use: `withSchool()`, `getSession()`, `assertEditorScope()`

### Integration Points
- `lib/db/` — new directory; `schema.ts` defines Drizzle tables, `client.ts` exports `db` (RLS wrapper) and `supabaseAdmin` (service-role, restricted import)
- `lib/auth/` — new directory; `session.ts` + `scopes.ts`
- `db/migrations/` — new directory; one `.sql` file per schema change (never edit existing files)
- `db/seed.ts` — new file; canonical school bootstrap
- `app/api/` — no routes exist yet; Phase 1 may add minimal auth API routes if needed by Next.js App Router auth flow

</code_context>

<specifics>
## Specific Ideas

- The executor must emit a `checkpoint:human-action` for env var collection BEFORE any Supabase connection attempt — failing fast with a clear prompt is better than a confusing connection error
- `lib/db/client.ts` must be the ONLY file that imports the Supabase service-role key; ESLint rule (DB-04) enforces this at lint time
- Seed script (`db/seed.ts`) must be idempotent — safe to re-run without duplicating data

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-database-rls-auth*
*Context gathered: 2026-05-09*
