# School Gantt Chart System — Implementation Plan

> **Terminology:** PRD says "tenant" — in this plan that means **a school**. "Users" splits into **staff** (editors + admins, who log in) and **public viewers** (students, parents, anyone unauthenticated).

---

## 1. Summary

- Web app for **schools**. Each school has ~15 staff editors + 1–2 admins; everyone else (students, parents, teachers without an editor account) browses without logging in.
- Core flow: **staff editor fills a 7-step wizard → submits → school admin approves or rejects → event becomes public on 4 synchronized views** (Gantt, printable yearly grid, mobile agenda, per-user iCal feed).
- Single source of truth: `events` table, scoped per school via Postgres row-level security; every state change is captured in `event_revisions` for audit; events are soft-deleted.
- All 4 public views read the same data and share filter state in URL query params (`?grades=10,11&types=trip,exam`), so a filtered link is shareable.
- Hard non-functional bars: Gantt ≤ 2 s for 1k events, iCal ≤ 500 ms, WCAG 2.1 AA, color + glyph (color-blind safe), print-legible on A3/A4 monochrome.

---

## 2. The editor → pending → admin approval flow (expanded)

This is the heart of the system. Walking through it slowly so we share the same picture before coding.

### 2.1 Roles in this flow

Concrete picture for a school with grades 7–12:

- **School management = admin** (principal, vice-principal, ops lead). Login required. Full power: create or edit *any* event in *any* grade, approve or reject submissions, manage staff and their scopes, configure event-type palette and the academic year. Their own events skip the approval queue and are auto-approved.
- **Grade supervisor teacher = editor with grade scope** (the lead/supervisor teacher in charge of a whole grade — e.g., one per grade for grades 7, 8, 9, 10, 11, 12). Login required. Creates events scoped to their grade(s); their events go through the admin approval queue before becoming public. Stored in DB as a `staff_users` row with `role='editor'` plus `editor_scopes` rows: `{kind:'grade', value:10}` for the 10th-grade supervisor.
- **Department / category editor = editor with event-type scope** (e.g., the school counselor owns counseling events across multiple grades; the trip coordinator owns all trips). Login required. Same approval flow. Scope expressed via `editor_scopes` rows of `kind='event_type'`. A counselor scoped to `event_type='counseling'` can attach the event to grades 11+12 simultaneously (PRD §5).
- **Regular class teacher = public viewer (no account)**. Browses `/[school]/agenda` (or Gantt, calendar) without logging in, filters to their class's grade, optionally subscribes via iCal if they want it on Google Calendar. They never create or edit. If later we want personalized features (favorites, "my classes"), we add a fourth role; not v1.
- **Students, parents, public = public viewer (no account)**. Same surface as class teachers.

Mapping to PRD roles: `admin` = management, `editor` = supervisor teachers + department editors (scope distinguishes them), `viewer` = everyone else.

**Two consequences for the data model:**

1. `editor_scopes` carries the grade vs event-type distinction the PRD already specifies — no schema change needed.
2. We seed each school in Phase 1 with **one admin + six grade-supervisor editor accounts** (one per grade 7–12) as the default skeleton. Department editors are added per-school as needed.

### 2.2 Event lifecycle (state machine)

```
            ┌──────────┐  step1..6 autosave         ┌─────────┐
   editor ─►│  draft   │──────────────────────────► │ pending │
            └──────────┘  step7 "Submit"            └────┬────┘
                                                         │
                                          admin opens    │
                                          /admin/queue   │
                                                         │
                       ┌──── reject(reason) ─────────────┤
                       │                                 │
                       ▼                                 ▼
                ┌────────────┐                   ┌──────────────┐
                │  rejected  │                   │   approved   │ ← public sees this
                └─────┬──────┘                   └──────┬───────┘
                      │ editor revises and                │
                      │ resubmits                         │ editor edits
                      └────► back to "pending"            │ approved event
                                                          ▼
                                              ┌──────────────────────┐
                                              │ approved (v1) public │
                                              │ + pending (v2) hidden│
                                              └──────────────────────┘
                                              v2 approval replaces v1
```

Plain-English version:

1. Editor clicks **"New event"** → wizard opens. The system creates a row in `events` with `status='draft'` immediately so the wizard can autosave on every step.
2. Editor walks through the 7 steps. After every step the system saves the partial event back to that draft row. If the editor closes the tab, they can resume from `/dashboard` and pick up where they left off.
3. On Step 7 the editor clicks **"Submit for approval."** The row flips to `status='pending'` and a new row goes into `event_revisions` capturing exactly what was submitted, by whom, and when. Public viewers still cannot see this event.
4. The school admin opens **`/admin/queue`** and sees a list of all pending events for their school, sorted by submission time. Each row shows summary info, the editor's name, and **Approve** + **Reject** buttons.
5. **Approve**: status flips to `approved`, an `event_revisions` row records the approval (admin name, time). The event now appears in all 4 public views — **within 5 seconds** of the click.
6. **Reject**: a modal opens asking for a reason (required). Status flips to `rejected`, revision row records reason. The editor sees the reason on their `/dashboard` next time they log in. They can revise the event and submit again, which loops it back to `pending`.
7. **Editing an already-approved event**: the editor's edit creates a *new pending revision* but **the previously approved version stays public** until the admin approves the new revision. This means viewers never see a half-edited event.
8. **Admins editing**: events created or edited by an admin **skip the queue** — they're auto-approved on save. The revision row records `decided_by = admin themselves` so the audit trail still exists.

### 2.3 What "within 5 seconds" actually means

When the admin clicks Approve, three things happen:
- DB write commits.
- The cached query for the public viewer endpoint is invalidated (Next.js cache tag on `events:school=<id>`).
- The next page load (or polling tick) for any viewer fetches the fresh data.

So "within 5 seconds" is the worst case of "polling cadence + cache TTL." Polling + 5 s `Cache-Control` (decision E1) hits this bar.

### 2.4 Where audit + history live

`event_revisions` is the single audit trail. Every transition (submit, approve, reject, edit-approved, hard-delete) writes one row. This drives the future "Auditor" role and lets us answer "who approved this trip on what date?" forever.

---

## 3. Decisions locked

| # | Area | Decision |
|---|---|---|
| A1 | Frontend | **Next.js App Router** |
| A2 | Backend | **Same Next.js — Server Actions / Route Handlers** |
| A3 | DB + Auth | **Supabase (Postgres + Auth + RLS)** |
| A4 | Email | **Resend** |
| B1 | Isolation | **Single schema + Postgres RLS on `school_id`** |
| B2 | Onboarding | **Manual seed via CLI / SQL for v1** |
| C1 | Gantt | **Custom SVG/Canvas** |
| C2 | Multi-grade event | **Single bar spanning across all relevant grade rows** |
| D1 | Print | **CSS `@media print` + browser 'Save as PDF'** |
| E1 | Freshness | **Polling with short `Cache-Control` (~5 s TTL)** |
| F1 | Drafts | **Server-side draft row, autosave on every wizard step** |
| G1 | i18n lib | **`next-intl`** |
| G2 | Hebrew dates | **v1: Gregorian only, defer Hebrew calendar to v1.1** |
| H1 | Concurrent edits | **Last-write-wins + `If-Match`/`version` toast warning** |
| I1 | iCal tokens | **No auto-expiry; manual revoke + rotate-on-password-reset** |
| J1 | Editor scopes | **AND across kinds, OR within a kind** |
| K1 | Glyphs | **Hardcoded mapping per `event_type.key`** |

---

## 4. Architecture

### 4.1 Data model (Postgres)

Mirrors PRD §7 with minor additions:

```
schools(id, slug UNIQUE, name, locale, timezone, active_academic_year_id)
                 -- "tenants" in the PRD; called "schools" here
academic_years(id, school_id, label, start_date, end_date)
staff_users(id, school_id, email, password_hash, full_name,
            role, created_at, locked_until)
                 -- role ∈ {editor, admin}; public viewers don't have rows
editor_scopes(id, staff_user_id, scope_kind, scope_value)
                 -- scope_kind ∈ {grade, event_type}
event_types(id, school_id, key, label_he, label_en, color_hex,
            glyph, sort_order, is_active)
events(id, school_id, academic_year_id, created_by_staff_id,
       status, title, event_type_id, date, all_day, start_time, end_time,
       responsible_text, requirements_richtext,
       created_at, updated_at, approved_at, approved_by_staff_id, rejected_reason,
       deleted_at,            -- soft delete
       version int             -- ETag source
)                 -- status ∈ {draft, pending, approved, rejected}
event_grades(event_id, grade)            -- composite PK
event_revisions(id, event_id, snapshot JSONB, submitted_at, submitted_by_staff_id,
                decided_at, decided_by_staff_id, decision, reason)
ical_subscriptions(id, staff_user_id, token, filter_grades, filter_event_types,
                   created_at, last_fetched_at, revoked_at)
audit_log(id, school_id, actor_staff_id, action, target_table, target_id, payload, at)
```

RLS: every table with `school_id` enforces `school_id = current_setting('app.school_id')::uuid`. Service-role key used only inside `/lib/db` helpers. The iCal endpoint sets `app.school_id` after looking up the token.

### 4.2 Module layout (TS, Next.js App Router)

```
/app
  /(public)
    /[school]/page.tsx              — Gantt
    /[school]/calendar/page.tsx     — yearly grid
    /[school]/agenda/page.tsx       — mobile
  /(staff)
    /dashboard, /events/new, /events/[id]/edit, /profile
  /(admin)
    /admin/queue, /admin/staff, /admin/event-types, /admin/year
  /api
    /v1/events, /v1/events/[id], /v1/events/[id]/{submit,approve,reject}
    /v1/event-types, /v1/staff, /v1/staff/[id]/scopes
    /v1/ical-subscriptions, /v1/auth/*
  /ical/[token]/route.ts            — text/calendar
/lib
  /db (drizzle/kysely + RLS helpers)
  /auth (session, scope checks)
  /events (domain logic: create/submit/approve/reject/revisions)
  /ical (VEVENT serializer + filter resolver)
  /views (event → gantt/calendar/agenda projections)
  /i18n (he, en)
/components
  WizardStep[1..7], FilterBar, GanttCanvas, YearCalendarGrid,
  AgendaList, EventChip, ApprovalQueueRow
/db/migrations  (one .sql per change)
/db/seed.ts
/test  (Vitest unit + Playwright e2e)
```

### 4.3 Reuse vs new

Greenfield — **all new**. External libs to use: `zod`, `drizzle-orm` (or `kysely`) + `pg`, `next-intl`, `ical-generator`, `tailwind` + `shadcn/ui`, `lucide-react`, `playwright`, `resend`.

---

## 5. Phased plan (8 phases, each shippable)

Each phase ends with a single concrete **End-of-phase goal** — a one-sentence "done = this works" target the code must hit.

### Phase 0 — Foundation (S)
**Scope:** repo scaffold (Next.js App Router + TS), Tailwind + shadcn/ui, ESLint/Prettier, Vitest + Playwright wiring, CI (lint + test + typecheck). RTL audit on shadcn components.
**Files:** `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.github/workflows/ci.yml`, `app/layout.tsx`, placeholder `app/page.tsx`, `README.md`.
**End-of-phase goal:** "`pnpm dev` opens a Hebrew-RTL placeholder page at `localhost:3000` saying *שלום עולם*, and `pnpm test` runs zero tests successfully on CI."

### Phase 1 — Database, RLS, auth, school bootstrap (M)
**Scope:** schema migrations for all PRD §7 tables (renamed per §4.1), RLS policies, Supabase Auth wired (email login + password reset via Resend + lockout), `current_user` server helper, seed script.
**Files:** `db/migrations/0001_init.sql..0010_*.sql`, `lib/db/client.ts`, `lib/auth/*.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/forgot/page.tsx`, `db/seed.ts`.
**Seed contents:** one school, one management admin, six grade-supervisor editor accounts (grades 7–12, each with `editor_scopes` row pinning them to their grade), one department editor example (counselor with event-type scope = `counseling`), and the 11 default event types from PRD §6.2 Step 3.
**End-of-phase goal:** "An admin from the seed script can log in, hit a protected route, and see only their school's data; cross-school access returns 404. The 12th-grade supervisor editor can log in and is restricted to grade 12 by RLS+scope checks."

### Phase 2 — Event CRUD + 7-step wizard with draft autosave (M)
**Scope:** `events` API (POST creates draft, PATCH per step, soft DELETE), wizard UI (7 RTL screens with Back/Next), date picker bounded by active academic year, scope-aware grade multi-select, submit-for-approval action, draft list on `/dashboard`.
**Files:** `app/api/v1/events/*`, `app/(staff)/events/new/*`, `components/Wizard/*`, `lib/events/*`, `test/e2e/wizard.spec.ts`.
**End-of-phase goal:** "An editor logs in, completes the 7-step wizard for a 10th-grade trip in under 60 seconds, refreshes mid-way, resumes the draft, and sees `status='pending'` in the database after Submit."

### Phase 3 — Approval workflow + admin queue + revisions (M)
**Scope:** `/admin/queue` listing pending events sorted by submission time, approve/reject endpoints, reject-reason modal, `event_revisions` writes on every transition, edit-of-approved produces a new pending revision while v1 stays public, admin-created events auto-approve.
**Files:** `app/(admin)/queue/*`, `app/api/v1/events/[id]/{approve,reject}/route.ts`, `lib/events/approval.ts`, `lib/events/revisions.ts`.
**End-of-phase goal:** "An admin clicks Approve on an editor's pending event, and within 5 seconds an unauthenticated browser at `/[school]/agenda` shows that event."

### Phase 4 — Public surface part 1: filter bar + agenda (mobile) view (M)
**Scope:** unauthenticated `/[school]/agenda` route, shared `FilterBar` (grades, types, search) writing to `?grades=&types=&q=`, week-grouped vertical agenda, expand-on-tap, 44 px tap targets.
**Files:** `app/(public)/[school]/agenda/page.tsx`, `components/FilterBar.tsx`, `components/AgendaList.tsx`, `lib/views/agenda.ts`.
**End-of-phase goal:** "A parent on a phone opens `/[school]/agenda?grades=10`, sees only 10th-grade approved events grouped by week, taps one to expand it, and Lighthouse mobile a11y scores ≥ 95."

### Phase 5 — Gantt view (M/L)
**Scope:** `/[school]` route, horizontal Sept–Jul timeline, one row per grade, multi-grade events render as single bar spanning the relevant rows (decision C2), zoom presets month/term/year, sticky grade column, chips colored + glyphed by event type, click → drawer with details, perf budget 1k events ≤ 2 s.
**Files:** `app/(public)/[school]/page.tsx`, `components/Gantt/*`, `lib/views/gantt.ts`.
**End-of-phase goal:** "Loading `/[school]` with 1,000 seeded events on a fresh tab paints the Gantt in under 2 seconds and zoom + horizontal scroll stay at 60 fps."

### Phase 6 — Printable yearly calendar + monochrome fallback (M)
**Scope:** `/[school]/calendar`, 11-month grid Sept–Jul, `@media print` rules for A3 + A4, monochrome glyph fallback, paginated one-page-per-month.
**Files:** `app/(public)/[school]/calendar/page.tsx`, `components/YearCalendarGrid.tsx`, `app/print.css`.
**End-of-phase goal:** "Hitting `/[school]/calendar` and using browser 'Save as PDF' produces an 11-page A4 PDF where every event chip is legible in black-and-white print preview."

### Phase 7 — iCal feed + per-staff subscriptions (S/M)
**Scope:** `/profile` token UI, `POST/DELETE /ical-subscriptions`, `GET /ical/[token]`, VEVENT mapping per PRD §6.4, ETag + 5-minute cache, 404 on revoked tokens within 1 minute, rotate-on-password-reset.
**Files:** `app/(staff)/profile/page.tsx`, `app/api/v1/ical-subscriptions/*`, `app/ical/[token]/route.ts`, `lib/ical/serializer.ts`.
**End-of-phase goal:** "A staff user generates a token on `/profile`, pastes the URL into Google Calendar 'From URL', and within Google's next refresh sees their school's filtered events; revoking the token returns 404 within 60 seconds."

### Phase 8 — Polish: a11y / i18n / perf / QA (M)
**Scope:** WCAG 2.1 AA pass via axe-core, keyboard-only sweep on the wizard, color-blind glyph audit, en↔he toggle wired, all 4 views regression-tested via Playwright, README + ops docs.
**Files:** `messages/{he,en}.json`, `tests/a11y/*`, perf scripts.
**End-of-phase goal:** "`pnpm test:e2e` runs every PRD §14 acceptance criterion in CI and passes; axe-core reports zero serious or critical issues across all 4 views."

---

## 6. Risks & unknowns

- **Gantt perf.** Custom SVG slows >2k DOM nodes. Mitigation: virtualize off-viewport bars or move to Canvas. Validate in a Phase 5 spike.
- **RLS bypass risk.** Easy to accidentally use the service-role client. Mitigation: a single `db.withSchool(schoolId, fn)` wrapper sets `app.school_id`; ESLint rule bans raw service client outside `/lib/db`.
- **Hebrew RTL + shadcn/ui.** shadcn is LTR-first; Popover/Calendar/Dropdown need patches. Budget half a day in Phase 0.
- **Date timezone bugs.** DB stores `date` (no tz) + `time`; rendering must reconstitute as `Asia/Jerusalem` consistently. Centralize in `lib/datetime.ts`.
- **Google Calendar refresh cadence.** Up to 24 h. PRD acceptance allows it but users will report it as a bug — surface this in `/profile` copy.
- **`event_revisions` size growth.** JSONB snapshot per transition; archive monthly job (Phase 8 or v1.1).
- **Concurrent edits.** Last-write-wins is the v1 default. `If-Match`/`version` from day 1 so we can layer a real UX later without migration.
- **Ministry vacations import.** Out of v1 but admins will ask. Plan for a CSV import in `/admin/year` as a Phase 8 stretch.
- **Three PRD source files** (`PRD_*.md`, `PRD_*.docx`, `לוח גאנט.docx`). This plan reads only the `.md`. Confirm `.md` is canonical.
- **Lockout threshold not specified.** Pick during Phase 1 (suggest 10 attempts / 15 min).
- **Hebrew password-reset email deliverability.** SPF/DKIM/DMARC must be set on whatever domain you use; budget half a day in Phase 1.

---

## 7. Verification plan (cross-cutting)

- **Unit:** Vitest on `lib/events/*`, `lib/ical/*`, `lib/views/*`. Aim ≥ 80 % coverage.
- **Integration:** Postgres test container per CI run; RLS positive/negative cases.
- **E2E:** Playwright traces — login, full wizard, approve, all 4 views, iCal subscribe-and-render. Run on every PR.
- **Manual:** stopwatch the 60-second wizard goal once per phase; print one calendar to A4 + A3 at end of Phase 6.
- **Perf:** Lighthouse + custom load script (1k synthetic events) on Gantt and iCal.
- **A11y:** axe-core in CI; manual keyboard-only walkthrough in Phase 8.

---

## 8. Ready to start

All §3 decisions locked. Phase 0 begins on user signal.
