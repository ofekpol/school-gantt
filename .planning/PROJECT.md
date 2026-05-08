# School Gantt Chart System

## What This Is

Multi-tenant school event calendar where each school is an isolated tenant (Postgres RLS). Staff editors submit events through a 7-step wizard → school admin approves or rejects → events appear on 4 synchronized public views (Gantt chart, printable yearly calendar, mobile agenda, per-user iCal feed). Unauthenticated public viewers (students, parents, teachers) browse without accounts.

## Core Value

An admin can approve a staff-submitted event and it appears publicly across all views within 5 seconds.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Staff editor fills 7-step wizard, autosaves draft per step, submits for approval
- [ ] School admin approves or rejects pending events (with rejection reason)
- [ ] Approved events appear on all 4 public views within 5 seconds of approval
- [ ] Multi-tenant isolation: each school sees only its own data (Postgres RLS)
- [ ] Hebrew RTL layout across all views
- [ ] Gantt view: horizontal Sept–Jul timeline, one row per grade, multi-grade events as single spanning bar, ≤ 2 s with 1k events
- [ ] Public agenda view: week-grouped, 44 px tap targets, Lighthouse mobile a11y ≥ 95
- [ ] Printable yearly calendar: A3/A4 monochrome-legible PDF via browser print
- [ ] iCal feed: per-staff token, filter by grade/type, revoke-on-demand, ≤ 500 ms response
- [ ] Event state machine: draft → pending → approved/rejected → revision flow
- [ ] Shared filter bar (grades, types, search) synced in URL params, shareable links
- [ ] WCAG 2.1 AA: axe-core zero serious/critical issues
- [ ] Color + glyph encoding (color-blind safe)

### Out of Scope

- Hebrew calendar dates — v1 Gregorian only; deferred to v1.1
- Ministry vacations import — CSV import planned for future phase
- Regular class teacher accounts — public viewers don't have accounts in v1
- Real-time websockets for freshness — polling + 5 s Cache-Control is sufficient
- Concurrent edit conflict UI — last-write-wins with `If-Match`/`version` toast warning only

## Context

- **Locale:** Hebrew (he) is primary locale; English (en) supported. RTL layout throughout. `<html dir="rtl" lang="he">`.
- **Users:** ~15 staff editors + 1–2 admins per school (login required); everyone else is unauthenticated public.
- **Editor scopes:** grade-supervisor editors locked to one or more grades; department editors locked to an event type (e.g., counselor owns all counseling events). Stored as `editor_scopes` rows.
- **Grades:** 7–12. One grade-supervisor editor per grade seeded by default.
- **Academic year:** Sept–Jul (Israeli school year). Events bounded by `active_academic_year_id`.
- **Timezone:** Asia/Jerusalem for all date rendering.
- **Event types:** 11 default types per PRD §6.2 Step 3 (trips, exams, counseling, etc.) with color_hex + glyph.
- **Audit trail:** `event_revisions` captures every state transition with JSONB snapshot.
- **Soft deletes:** `events.deleted_at` — never hard-delete events.
- **iCal:** Token-gated, unauthenticated. Tokens rotate on password reset. ETag + 5-min cache.
- **Concurrent edits:** `events.version` used as ETag; last-write-wins; toast warning on conflict.

## Constraints

- **Tech Stack:** Next.js 15 App Router + React 19 + TypeScript 5 strict; Tailwind + shadcn/ui; Supabase (Postgres + Auth + RLS); Drizzle ORM + `pg`; `next-intl`; `ical-generator`; Resend; Zod; Vitest + Playwright
- **RTL:** CSS logical properties only (`start`/`end`) — never hardcode `left`/`right` in layout/position styles
- **DB safety:** Every query touching school data must use `db.withSchool(schoolId, fn)`. ESLint rule bans raw service client outside `lib/db/`
- **Security:** Parameterized SQL only; no SQL string interpolation; `supabaseAdmin` only inside `lib/db/`
- **Auth lockout:** 10 failed attempts / 15 min window
- **Performance:** Gantt ≤ 2 s first paint (1k events); iCal ≤ 500 ms; public view freshness ≤ 5 s after approval
- **Coverage:** ≥ 80% on new code; integration tests use real Postgres (no mocks)
- **Code style:** Functions < 50 lines; files < 400 lines; no `any`; `snake_case` DB → `camelCase` frontend transformed at API layer

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js App Router (A1/A2) | Full-stack TS, server components, route handlers | — Pending |
| Supabase RLS for multi-tenancy (B1) | Single schema, no per-tenant DB, RLS on `school_id` | — Pending |
| Custom SVG/Canvas Gantt (C1) | No off-shelf Gantt handles RTL + multi-grade spanning bars | — Pending |
| CSS `@media print` for PDF (D1) | No server-side rendering needed; browser handles A3/A4 | — Pending |
| Polling + 5 s Cache-Control (E1) | Simpler than websockets; meets ≤ 5 s freshness bar | — Pending |
| Server-side draft row (F1) | Autosave on every wizard step; resume on tab close | — Pending |
| `next-intl` for i18n (G1) | First-class Next.js App Router support; RTL-compatible | — Pending |
| Gregorian only v1 (G2) | Hebrew calendar is a separate complex problem; defer | — Pending |
| Last-write-wins + version ETag (H1) | Simple; version field enables future optimistic locking | — Pending |
| Token-based iCal, no auto-expiry (I1) | Users expect persistent calendar subscriptions | — Pending |
| AND-across-kinds, OR-within-kind scopes (J1) | Matches real-world permission model (counselor can do all grades) | — Pending |
| Hardcoded glyph mapping per event_type.key (K1) | Avoids admin glyph picker complexity for v1 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-09 after initialization*
