# Requirements — School Gantt Chart System

> Source: IMPLEMENTATION_PLAN.md (decisions locked). All v1 requirements below.

---

## v1 Requirements

### Foundation & Infrastructure

- [x] **INFRA-01**: Developer can run `pnpm dev` and see Hebrew-RTL placeholder at `localhost:3000`
- [x] **INFRA-02**: `pnpm test` runs zero tests successfully (Vitest wired)
- [x] **INFRA-03**: `pnpm playwright test` runs Playwright e2e suite (wired, zero tests)
- [x] **INFRA-04**: CI pipeline (lint + typecheck + test) runs on every push
- [x] **INFRA-05**: shadcn/ui RTL patches applied for Popover, Calendar, Dropdown components

### Database & Multi-Tenancy

- [x] **DB-01**: All PRD tables exist with correct schema (schools, academic_years, staff_users, editor_scopes, event_types, events, event_grades, event_revisions, ical_subscriptions, audit_log)
- [x] **DB-02**: Postgres RLS enforces `school_id = current_setting('app.school_id')` on every school-scoped table
- [x] **DB-03**: `db.withSchool(schoolId, fn)` wrapper sets `app.school_id` and all queries inside are RLS-scoped
- [ ] **DB-04**: ESLint rule prevents importing `supabaseAdmin` outside `lib/db/`
- [x] **DB-05**: Cross-school access returns 404 (RLS denial surfaces as not-found, not 403)
- [x] **DB-06**: Seed script creates one school, one admin, six grade-supervisor editors (grades 7–12), one department editor (counselor), and 11 default event types

### Authentication

- [x] **AUTH-01**: Staff user can log in with email + password via Supabase Auth
- [ ] **AUTH-02**: Staff user can request password reset; receives email via Resend
- [x] **AUTH-03**: Account locks after 10 failed login attempts within 15 minutes
- [x] **AUTH-04**: `getSession()` server helper returns current authenticated user
- [x] **AUTH-05**: `assertEditorScope(user, grade?, eventType?)` throws 403 on scope violation
- [x] **AUTH-06**: Admins (`role='admin'`) can access all school data; editors are restricted by `editor_scopes`
- [x] **AUTH-07**: Public routes are fully unauthenticated — no session check

### Event CRUD & Wizard

- [ ] **WIZARD-01**: Staff editor can create a new event via 7-step wizard (all fields per PRD §6.2)
- [ ] **WIZARD-02**: Wizard autosaves draft to server on every step (draft row created immediately on open)
- [ ] **WIZARD-03**: Editor can close tab and resume draft from `/dashboard`
- [ ] **WIZARD-04**: Date picker is bounded by active academic year dates
- [ ] **WIZARD-05**: Grade multi-select respects editor's grade scopes (can't select grades outside scope)
- [ ] **WIZARD-06**: Step 7 "Submit for approval" flips status from `draft` → `pending`
- [ ] **WIZARD-07**: Dashboard shows editor's draft and pending events with status indicators
- [ ] **WIZARD-08**: Editor can soft-delete their own draft events
- [ ] **WIZARD-09**: Concurrent edit: `If-Match` / `version` check; toast warning on conflict (last-write-wins)

### Approval Workflow

- [ ] **APPROVAL-01**: Admin sees `/admin/queue` listing all pending events for their school, sorted by submission time
- [ ] **APPROVAL-02**: Admin can approve a pending event; status flips to `approved`; event appears in public views within 5 seconds
- [ ] **APPROVAL-03**: Admin can reject a pending event with a required reason; status flips to `rejected`
- [ ] **APPROVAL-04**: Editor sees rejection reason on `/dashboard` and can revise + resubmit (rejected → pending)
- [ ] **APPROVAL-05**: Admin editing an event creates auto-approved revision (skips queue); revision row records `decided_by = admin`
- [ ] **APPROVAL-06**: Editor editing an already-approved event creates new pending revision (v2) while v1 stays public
- [ ] **APPROVAL-07**: Every status transition writes a row to `event_revisions` with JSONB snapshot

### Public Views — Filter Bar

- [ ] **FILTER-01**: Shared `FilterBar` component with grades, event-types, and text search inputs
- [ ] **FILTER-02**: Filter state lives in URL query params (`?grades=10,11&types=trip,exam&q=`)
- [ ] **FILTER-03**: Filtered URLs are shareable — same filter applied on load

### Public Views — Agenda (Mobile)

- [ ] **AGENDA-01**: Unauthenticated user can open `/[school]/agenda` and see approved events
- [ ] **AGENDA-02**: Events displayed in week-grouped vertical list
- [ ] **AGENDA-03**: Tap on event expands it to show full details
- [ ] **AGENDA-04**: All interactive targets are ≥ 44 px
- [ ] **AGENDA-05**: Lighthouse mobile accessibility score ≥ 95

### Public Views — Gantt

- [ ] **GANTT-01**: Unauthenticated user can open `/[school]` and see approved events on a Gantt chart
- [ ] **GANTT-02**: Horizontal timeline spans Sept–Jul; one row per grade (7–12)
- [ ] **GANTT-03**: Multi-grade events render as a single bar spanning all relevant grade rows
- [ ] **GANTT-04**: Event chips colored + glyphed by event type (color-blind safe, hardcoded glyph map)
- [ ] **GANTT-05**: Zoom presets: month / term / full year
- [ ] **GANTT-06**: Grade column is sticky on horizontal scroll
- [ ] **GANTT-07**: Clicking an event chip opens a details drawer
- [ ] **GANTT-08**: First paint with 1,000 events ≤ 2 seconds; zoom + scroll stays at 60 fps

### Public Views — Printable Yearly Calendar

- [ ] **CAL-01**: Unauthenticated user can open `/[school]/calendar` and see 11-month grid (Sept–Jul)
- [ ] **CAL-02**: Browser "Save as PDF" produces legible output on A4 and A3 paper sizes
- [ ] **CAL-03**: Monochrome print: events legible in black-and-white (glyph fallback)
- [ ] **CAL-04**: Layout paginates one month per printed page

### iCal Feed

- [ ] **ICAL-01**: Staff user can generate a personal iCal subscription token on `/profile`
- [ ] **ICAL-02**: Token can be filtered by grade(s) and/or event type(s)
- [ ] **ICAL-03**: `GET /ical/[token]` returns valid `text/calendar` with school's filtered approved events
- [ ] **ICAL-04**: iCal response includes ETag and 5-minute Cache-Control
- [ ] **ICAL-05**: iCal response ≤ 500 ms
- [ ] **ICAL-06**: Staff user can revoke a token; revoked token returns 404 within 60 seconds
- [ ] **ICAL-07**: Token rotates automatically on password reset
- [ ] **ICAL-08**: Pasting the iCal URL into Google Calendar shows filtered school events

### Accessibility & i18n

- [ ] **A11Y-01**: All 4 public views pass axe-core with zero serious or critical issues
- [ ] **A11Y-02**: Wizard is fully operable by keyboard only
- [ ] **A11Y-03**: Color + glyph encoding is color-blind safe across all views
- [ ] **I18N-01**: Hebrew (`he`) is default locale; English (`en`) toggle works across all views
- [ ] **I18N-02**: All user-visible strings use `next-intl` `t()` — no hardcoded string literals in JSX
- [ ] **I18N-03**: All dates rendered via `lib/datetime.ts` using `Asia/Jerusalem` timezone

### Admin Management

- [ ] **ADMIN-01**: Admin can manage staff users (create, edit, deactivate) at `/admin/staff`
- [ ] **ADMIN-02**: Admin can configure event types (label, color, glyph, order) at `/admin/event-types`
- [ ] **ADMIN-03**: Admin can configure the active academic year at `/admin/year`

### Non-Functional

- [ ] **PERF-01**: Public views use ≤ 5 s `Cache-Control`; approved events appear within 5 s of approval
- [ ] **PERF-02**: Gantt: ≤ 2 s first paint with 1k events
- [ ] **PERF-03**: iCal feed: ≤ 500 ms response time
- [ ] **SEC-01**: Parameterized queries only — no SQL string interpolation
- [ ] **SEC-02**: No `any` in TypeScript; strict mode enforced
- [ ] **SEC-03**: Environment variables for all secrets; never committed
- [ ] **TEST-01**: ≥ 80% test coverage on new code
- [ ] **TEST-02**: Integration tests use real Postgres — RLS positive access + cross-school denial
- [ ] **TEST-03**: E2E Playwright: full wizard flow, approval flow, all 4 public views, iCal subscribe + revoke

---

## v2 Requirements (Deferred)

- Hebrew calendar date display (alongside Gregorian)
- Ministry/national vacation CSV import at `/admin/year`
- Regular class teacher accounts (personalized favorites, "my classes" view)
- Auditor role for read-only `event_revisions` access
- `event_revisions` archival job (monthly)
- Real-time websocket push for public view freshness
- Conflict resolution UI for concurrent edits (beyond last-write-wins toast)

---

## Out of Scope

- **Hebrew calendar (v1)** — complex separate problem; Gregorian suffices for launch
- **OAuth / magic-link login** — email + password is sufficient for staff accounts
- **Public viewer accounts** — v1 public is fully unauthenticated
- **Multi-school admin** — each admin manages exactly one school
- **Mobile native apps** — responsive web covers the agenda use case
- **Offline support / PWA** — out of scope for v1

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 0 — Foundation | Complete |
| INFRA-02 | Phase 0 — Foundation | Complete |
| INFRA-03 | Phase 0 — Foundation | Complete |
| INFRA-04 | Phase 0 — Foundation | Complete |
| INFRA-05 | Phase 0 — Foundation | Complete |
| DB-01 | Phase 1 — Database, RLS & Auth | Complete |
| DB-02 | Phase 1 — Database, RLS & Auth | Complete |
| DB-03 | Phase 1 — Database, RLS & Auth | Complete |
| DB-04 | Phase 1 — Database, RLS & Auth | Pending |
| DB-05 | Phase 1 — Database, RLS & Auth | Complete |
| DB-06 | Phase 1 — Database, RLS & Auth | Complete |
| AUTH-01 | Phase 1 — Database, RLS & Auth | Complete |
| AUTH-02 | Phase 1 — Database, RLS & Auth | Pending |
| AUTH-03 | Phase 1 — Database, RLS & Auth | Complete |
| AUTH-04 | Phase 1 — Database, RLS & Auth | Complete |
| AUTH-05 | Phase 1 — Database, RLS & Auth | Complete |
| AUTH-06 | Phase 1 — Database, RLS & Auth | Complete |
| AUTH-07 | Phase 1 — Database, RLS & Auth | Complete |
| WIZARD-01 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| WIZARD-02 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| WIZARD-03 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| WIZARD-04 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| WIZARD-05 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| WIZARD-06 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| WIZARD-07 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| WIZARD-08 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| WIZARD-09 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| ADMIN-01 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| ADMIN-02 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| ADMIN-03 | Phase 2 — Event CRUD & 7-Step Wizard | Pending |
| APPROVAL-01 | Phase 3 — Approval Workflow | Pending |
| APPROVAL-02 | Phase 3 — Approval Workflow | Pending |
| APPROVAL-03 | Phase 3 — Approval Workflow | Pending |
| APPROVAL-04 | Phase 3 — Approval Workflow | Pending |
| APPROVAL-05 | Phase 3 — Approval Workflow | Pending |
| APPROVAL-06 | Phase 3 — Approval Workflow | Pending |
| APPROVAL-07 | Phase 3 — Approval Workflow | Pending |
| FILTER-01 | Phase 4 — Filter Bar & Agenda View | Pending |
| FILTER-02 | Phase 4 — Filter Bar & Agenda View | Pending |
| FILTER-03 | Phase 4 — Filter Bar & Agenda View | Pending |
| AGENDA-01 | Phase 4 — Filter Bar & Agenda View | Pending |
| AGENDA-02 | Phase 4 — Filter Bar & Agenda View | Pending |
| AGENDA-03 | Phase 4 — Filter Bar & Agenda View | Pending |
| AGENDA-04 | Phase 4 — Filter Bar & Agenda View | Pending |
| AGENDA-05 | Phase 4 — Filter Bar & Agenda View | Pending |
| GANTT-01 | Phase 5 — Gantt View | Pending |
| GANTT-02 | Phase 5 — Gantt View | Pending |
| GANTT-03 | Phase 5 — Gantt View | Pending |
| GANTT-04 | Phase 5 — Gantt View | Pending |
| GANTT-05 | Phase 5 — Gantt View | Pending |
| GANTT-06 | Phase 5 — Gantt View | Pending |
| GANTT-07 | Phase 5 — Gantt View | Pending |
| GANTT-08 | Phase 5 — Gantt View | Pending |
| PERF-02 | Phase 5 — Gantt View | Pending |
| CAL-01 | Phase 6 — Printable Yearly Calendar | Pending |
| CAL-02 | Phase 6 — Printable Yearly Calendar | Pending |
| CAL-03 | Phase 6 — Printable Yearly Calendar | Pending |
| CAL-04 | Phase 6 — Printable Yearly Calendar | Pending |
| ICAL-01 | Phase 7 — iCal Feed & Subscriptions | Pending |
| ICAL-02 | Phase 7 — iCal Feed & Subscriptions | Pending |
| ICAL-03 | Phase 7 — iCal Feed & Subscriptions | Pending |
| ICAL-04 | Phase 7 — iCal Feed & Subscriptions | Pending |
| ICAL-05 | Phase 7 — iCal Feed & Subscriptions | Pending |
| ICAL-06 | Phase 7 — iCal Feed & Subscriptions | Pending |
| ICAL-07 | Phase 7 — iCal Feed & Subscriptions | Pending |
| ICAL-08 | Phase 7 — iCal Feed & Subscriptions | Pending |
| PERF-03 | Phase 7 — iCal Feed & Subscriptions | Pending |
| A11Y-01 | Phase 8 — Polish & QA | Pending |
| A11Y-02 | Phase 8 — Polish & QA | Pending |
| A11Y-03 | Phase 8 — Polish & QA | Pending |
| I18N-01 | Phase 8 — Polish & QA | Pending |
| I18N-02 | Phase 8 — Polish & QA | Pending |
| I18N-03 | Phase 8 — Polish & QA | Pending |
| PERF-01 | Phase 8 — Polish & QA | Pending |
| SEC-01 | Phase 8 — Polish & QA | Pending |
| SEC-02 | Phase 8 — Polish & QA | Pending |
| SEC-03 | Phase 8 — Polish & QA | Pending |
| TEST-01 | Phase 8 — Polish & QA | Pending |
| TEST-02 | Phase 8 — Polish & QA | Pending |
| TEST-03 | Phase 8 — Polish & QA | Pending |
