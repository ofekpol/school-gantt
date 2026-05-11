# Roadmap: School Gantt Chart System

## Overview

Nine phases deliver a multi-tenant school event calendar from blank repo to production-ready system. Phase 0 establishes the toolchain; Phase 1 locks the database and auth foundation; Phases 2–3 build the full staff workflow (wizard → approval); Phases 4–7 deliver the four public views (agenda, Gantt, printable calendar, iCal); Phase 8 closes all accessibility, i18n, and quality gates. Every phase ends with a single observable truth that can be verified without reading code.

## Phases

**Phase Numbering:**
- Integer phases (0–8): Planned milestone work
- Decimal phases (e.g. 2.1): Urgent insertions (marked INSERTED)

- [x] **Phase 0: Foundation** - Repo scaffold, RTL toolchain, CI wired, shadcn RTL patches applied (completed 2026-05-08)
- [x] **Phase 1: Database, RLS & Auth** - All schema tables, RLS policies, Supabase Auth, seed script (completed 2026-05-10)
- [x] **Phase 2: Event CRUD & 7-Step Wizard** - Full wizard with autosave, draft dashboard, admin management pages (completed 2026-05-11)
- [ ] **Phase 3: Approval Workflow** - Admin queue, approve/reject, revision audit trail, edit-of-approved
- [ ] **Phase 4: Filter Bar & Agenda View** - Shared FilterBar, mobile agenda with URL-synced filters
- [ ] **Phase 5: Gantt View** - Custom SVG/Canvas Gantt with zoom, sticky column, perf budget
- [ ] **Phase 6: Printable Yearly Calendar** - 11-month grid, A3/A4 monochrome print via browser PDF
- [ ] **Phase 7: iCal Feed & Subscriptions** - Token-gated feed, per-staff profile UI, revoke flow
- [ ] **Phase 8: Polish & QA** - WCAG 2.1 AA, i18n parity, Playwright full suite, perf gates

## Phase Details

### Phase 0: Foundation
**Goal**: Developer toolchain is fully operational with Hebrew RTL rendering and CI enforcing quality gates
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. Running `pnpm dev` opens `localhost:3000` showing a Hebrew RTL placeholder page
  2. Running `pnpm test` and `pnpm playwright test` both exit successfully (zero tests, no errors)
  3. Every push triggers CI that runs lint, typecheck, and test; a failing lint blocks merge
  4. shadcn Popover, Calendar, and Dropdown components render correctly in RTL direction without misaligned dropdowns
**Plans**: 3 plans
- [x] 00-01-PLAN.md — Repo scaffold + Next.js 15 + RTL root layout + Hebrew placeholder (INFRA-01)
- [x] 00-02-PLAN.md — Vitest + Playwright wiring + shadcn Popover/Calendar/Dropdown + RTL CSS overrides + showcase (INFRA-02, INFRA-03, INFRA-05)
- [x] 00-03-PLAN.md — GitHub Actions CI pipeline + branch protection on main (INFRA-04)
**UI hint**: yes

### Phase 1: Database, RLS & Auth
**Goal**: Staff can authenticate and the database enforces school-level data isolation from day one
**Depends on**: Phase 0
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. The seed-script admin can log in with email + password and reach a protected route
  2. The seed-script 12th-grade editor can log in and scope checks restrict them to grade 12 data
  3. A request authenticated as school A cannot read school B's data — the API returns 404, not 403
  4. After 10 failed login attempts within 15 minutes the account is locked
  5. An unauthenticated request to a public route succeeds without any session check
**Plans**: 5 plans
- [x] 01-00-PLAN.md — Wave 0 test scaffolding + env-var checkpoint (DB-01..06, AUTH-01,03..07 stubs)
- [x] 01-01-PLAN.md — Drizzle schema + initial migration + RLS policies + ESLint restriction (DB-01, DB-02, DB-04)
- [x] 01-02-PLAN.md — withSchool wrapper + apply migration + idempotent seed (DB-03, DB-05, DB-06)
- [x] 01-03-PLAN.md — Supabase clients + getSession + assertEditorScope + composed middleware (AUTH-04..07)
- [x] 01-04-PLAN.md — Login (with lockout) + logout + reset-password routes + Resend SMTP relay (AUTH-01, AUTH-02, AUTH-03)

### Phase 2: Event CRUD & 7-Step Wizard
**Goal**: A staff editor can create, autosave, resume, and submit an event for approval entirely through the UI
**Depends on**: Phase 1
**Requirements**: WIZARD-01, WIZARD-02, WIZARD-03, WIZARD-04, WIZARD-05, WIZARD-06, WIZARD-07, WIZARD-08, WIZARD-09, ADMIN-01, ADMIN-02, ADMIN-03
**Success Criteria** (what must be TRUE):
  1. An editor opens the wizard, fills all 7 steps for a 10th-grade trip, closes the tab, reopens the dashboard, resumes the draft, and submits — the event row shows `status = pending`
  2. The grade multi-select on step 3 only offers grades within the editor's assigned scope
  3. The date picker rejects dates outside the active academic year
  4. An admin can create, edit, and deactivate staff users at `/admin/staff` and configure event types at `/admin/event-types`
  5. A concurrent edit on the same event version shows a toast warning instead of silently overwriting
**Plans**: TBD
**UI hint**: yes

### Phase 3: Approval Workflow
**Goal**: An admin can approve or reject pending events, and approved events appear in public views within 5 seconds
**Depends on**: Phase 2
**Requirements**: APPROVAL-01, APPROVAL-02, APPROVAL-03, APPROVAL-04, APPROVAL-05, APPROVAL-06, APPROVAL-07
**Success Criteria** (what must be TRUE):
  1. `/admin/queue` lists all pending events for the school sorted by submission time
  2. Clicking Approve on a pending event causes it to appear on the public agenda within 5 seconds
  3. Clicking Reject requires a typed reason; the editor sees that reason on their dashboard and can revise and resubmit
  4. An editor editing an already-approved event leaves the original visible publicly while the revision waits in the queue
  5. Every status transition (submit, approve, reject, re-submit) produces a row in `event_revisions` with a JSONB snapshot
**Plans**: TBD
**UI hint**: yes

### Phase 4: Filter Bar & Agenda View
**Goal**: An unauthenticated mobile user can browse approved events by grade, share a filtered URL, and expand event details
**Depends on**: Phase 3
**Requirements**: FILTER-01, FILTER-02, FILTER-03, AGENDA-01, AGENDA-02, AGENDA-03, AGENDA-04, AGENDA-05
**Success Criteria** (what must be TRUE):
  1. Opening `/[school]/agenda` without logging in shows approved events grouped by week
  2. Selecting grades 10 and 11 in the FilterBar updates the URL to `?grades=10,11` and the list reflects the filter
  3. Pasting a filtered URL in a new browser tab opens with the same filter active
  4. Tapping an event row expands it to show full details; all tap targets are at least 44 px
  5. Lighthouse mobile accessibility score for the agenda page is 95 or higher
**Plans**: TBD
**UI hint**: yes

### Phase 5: Gantt View
**Goal**: An unauthenticated user can explore the full-year event Gantt with zoom and scroll without performance degradation
**Depends on**: Phase 4
**Requirements**: GANTT-01, GANTT-02, GANTT-03, GANTT-04, GANTT-05, GANTT-06, GANTT-07, GANTT-08, PERF-02
**Success Criteria** (what must be TRUE):
  1. Opening `/[school]` with 1,000 seeded events paints the full Gantt within 2 seconds on first load
  2. Multi-grade events render as a single bar spanning all relevant grade rows, not as separate per-grade chips
  3. Switching between month, term, and year zoom presets updates the visible timeline without layout jump; scrolling stays at 60 fps
  4. The grade column remains visible and fixed while scrolling horizontally
  5. Clicking an event chip opens a details drawer showing event metadata
**Plans**: TBD
**UI hint**: yes

### Phase 6: Printable Yearly Calendar
**Goal**: An unauthenticated user can print or save a monochrome-legible A4/A3 PDF of the full academic year
**Depends on**: Phase 5
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04
**Success Criteria** (what must be TRUE):
  1. Opening `/[school]/calendar` shows an 11-month grid from September to July
  2. Using browser "Save as PDF" on A4 produces 11 pages, one per month, with all event chips legible
  3. Printing to a monochrome printer (or selecting black-and-white in print dialog) keeps every event readable via glyph fallback
  4. The same PDF is legible at A3 size without content overflow or clipping
**Plans**: TBD
**UI hint**: yes

### Phase 7: iCal Feed & Subscriptions
**Goal**: A staff user can subscribe to a filtered iCal feed and revoke it on demand, with the feed responding in under 500 ms
**Depends on**: Phase 6
**Requirements**: ICAL-01, ICAL-02, ICAL-03, ICAL-04, ICAL-05, ICAL-06, ICAL-07, ICAL-08, PERF-03
**Success Criteria** (what must be TRUE):
  1. A staff user generates a subscription token on `/profile`, optionally filtering by grade and/or event type
  2. Pasting the token URL into Google Calendar "Subscribe from URL" shows the filtered school events
  3. The iCal endpoint returns a valid `text/calendar` response with ETag and 5-minute Cache-Control in under 500 ms
  4. Revoking a token on `/profile` causes the same URL to return 404 within 60 seconds
  5. Resetting the staff user's password automatically rotates their iCal token
**Plans**: TBD

### Phase 8: Polish & QA
**Goal**: All four public views pass WCAG 2.1 AA, Hebrew and English are fully parity, and the Playwright suite covers every PRD acceptance criterion
**Depends on**: Phase 7
**Requirements**: A11Y-01, A11Y-02, A11Y-03, I18N-01, I18N-02, I18N-03, PERF-01, SEC-01, SEC-02, SEC-03, TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Running `pnpm playwright test` in CI passes all wizard, approval, public-view, and iCal subscribe/revoke flows
  2. axe-core reports zero serious or critical issues across all four public views
  3. The 7-step wizard is fully operable using keyboard only (no mouse required)
  4. Toggling the locale between Hebrew and English updates every user-visible string across all views with no hardcoded literals remaining
  5. Approved events appear on all public views within 5 seconds of admin approval under the polling + Cache-Control setup
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in order: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Foundation | 3/3 | Complete   | 2026-05-09 |
| 1. Database, RLS & Auth | 5/5 | Complete   | 2026-05-10 |
| 2. Event CRUD & 7-Step Wizard | 1/1 | Complete   | 2026-05-11 |
| 3. Approval Workflow | 0/? | Not started | - |
| 4. Filter Bar & Agenda View | 0/? | Not started | - |
| 5. Gantt View | 0/? | Not started | - |
| 6. Printable Yearly Calendar | 0/? | Not started | - |
| 7. iCal Feed & Subscriptions | 0/? | Not started | - |
| 8. Polish & QA | 0/? | Not started | - |
