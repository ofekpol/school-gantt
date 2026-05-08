# School Gantt Chart System — Product Requirements Document

**Status:** Draft v0.1
**Owners:** Ofek / Maor
**Last updated:** 2026-05-05
**Audience:** Engineering

---

## 1. Overview

A web-based, multi-tenant scheduling system that lets a school's staff collaboratively maintain a single source of truth for the academic year and surface it through four synchronized output views: a Gantt timeline, a printable yearly calendar, a mobile-optimized calendar, and a Google Calendar feed.

Roughly 15 authorized editors per school maintain events scoped to their domain (e.g., the 10th-grade coordinator owns events for grade 10). Each editor's events render in a domain-specific color. Anyone — staff, students, parents — can view the resulting calendars and filter them to the slice they care about (e.g., "9th-grade social events only").

The product targets large Israeli schools and operates in Hebrew (RTL) on an academic-year cycle (September through July).

## 2. Goals

The system must let authorized staff add, edit, and approve events in under a minute through a wizard-style flow. Once approved, an event must propagate to all four output views within five seconds. Viewers must be able to filter the output by grade and event type without authentication. The system must integrate with Google Calendar (per-user subscription) and degrade gracefully on mobile devices.

## 3. Non-goals (v1)

The first release does not include automatic conflict detection, attendance tracking, parent communications, lesson plans, gradebook features, or in-app messaging. It does not support multiple academic-year templates running concurrently — a tenant operates on one active year at a time. It does not handle billing, payments, or subscription enforcement at the application layer; that lives in a separate admin/back-office system.

## 4. Personas and roles

The system has three role types within a school tenant.

**Viewer** is the default role for any unauthenticated user. Viewers can read all approved events in any output view and apply filters but cannot create, edit, or approve.

**Editor** is an authenticated staff member with a defined scope — typically a grade level (e.g., grade 10), a department (e.g., counseling), or an event category (e.g., trips). Editors can create and edit events within their scope, see their events on all views, and submit events for approval. There are roughly 15 editors per school.

**Administrator** is a school-level super-user (typically a vice-principal or operations lead). Administrators can manage editors and their scopes, approve or reject events submitted by editors, edit any event regardless of scope, and configure the school's academic year and event-type palette.

A future role — **Auditor** — is reserved for read access to the full audit log; not in scope for v1.

## 5. User stories

As a grade coordinator, I open the system, log in, and add a class trip for grade 10 on a specific date so it appears on the school's master calendar.

As a counselor, I add a counseling event scoped to grades 11 and 12 simultaneously, and it shows up on both grade views in the counseling color.

As a principal, I open the printable yearly calendar in late August, filter to "all grades, all event types," and print a wall copy for the staff room.

As a parent, I open the mobile view on my phone, filter to my child's grade, and bookmark or subscribe via Google Calendar so I see updates without revisiting the site.

As an administrator, I review pending events from editors, approve or reject each, and (when rejecting) attach a reason that the editor sees on their next login.

As an editor, I edit an event I previously created and the change re-enters the approval queue; the prior approved version remains visible until the new version is approved.

## 6. Functional requirements

### 6.1 Authentication and authorization

Editors and administrators authenticate via email and password. Sessions last 24 hours and renew on activity. Password reset is via email link. Viewers do not authenticate.

Authorization is scope-based. Each editor record carries a list of scopes; an editor may create events whose grade set and event-type are entirely within their granted scopes. Administrators have implicit scope over all grades and types within their tenant. Cross-tenant access is forbidden at the database layer (row-level security keyed on `tenant_id`).

### 6.2 Event creation flow

The system presents a seven-step wizard. Each step is a single screen on mobile and a stacked panel on desktop, with Back/Next controls. The wizard auto-saves a draft after every step so editors can resume.

**Step 1 — Date.** A date picker (single date for v1; date ranges deferred to v1.1). The picker disables dates outside the active academic year.

**Step 2 — Grades.** A multi-select of grades ז (7), ח (8), ט (9), י (10), יא (11), יב (12). At least one grade must be selected. The available set is filtered to the editor's scope.

**Step 3 — Event type.** A single-select from the configured palette: pedagogical event, social event, exam (מבחן), trip (טיול), specialization tour (סיור מגמה), של"ח tour, vacation (חופשה), parents' day, matriculation exam (בגרות), counseling event, other. Each type carries a color used in all output views.

**Step 4 — Name.** A free-text title (1–120 characters, Hebrew or English).

**Step 5 — Time window.** Start time and end time on the chosen date. The system enforces start < end. An "all-day" toggle skips the time fields.

**Step 6 — Responsible person.** A free-text field for the event owner (1–80 characters). v1.1 will replace this with a picker over school staff.

**Step 6b — Requirements.** A free-text rich-text field for logistics, supplies, room, etc. (0–2,000 characters).

**Step 7 — Submit.** A summary screen with all entered fields and a "Submit for approval" button. Until approved, the event is stored as `status = pending` and is not visible to viewers.

(Note: the source brief had two "Step 6"s — they're separated here as Step 6 and Step 6b.)

### 6.3 Approval workflow

When an editor submits, the event enters the administrator's queue. Administrators see a list view sorted by submission time with one-click Approve and Reject (Reject opens a reason modal). Approved events become visible to viewers immediately and propagate to Google Calendar within five seconds. Rejected events return to the editor with the reason attached; the editor can revise and resubmit.

Edits to an approved event re-enter the approval queue; the previously approved version remains the public version until the new version is approved or rejected.

Administrator-created events bypass the queue and are auto-approved.

### 6.4 Output views

All four views read from the same approved-events store and respect the same filter state (grades, event types) maintained per session in URL query params so views are shareable.

**Gantt view.** A horizontal timeline spanning the academic year. Rows are grades (one row per grade); bars are events colored by event type. Multi-grade events render as a single bar spanning the relevant rows or as duplicated bars (decision deferred to design — see Open Questions). The view supports zoom (month, term, year) and horizontal scroll. Reference inspiration: monday.com Gantt.

**Printable yearly calendar.** A month-by-month grid (Sept–July) sized for tabloid (A3) and letter (A4) print. Events appear as colored chips inside day cells with the event name truncated to fit. CSS `@media print` strips the chrome and ensures legible monochrome fallback (icons or patterns supplement color so it remains readable when printed in black and white).

**Mobile view.** A vertical agenda grouped by week and then day. Tap an event chip to expand its full details. Designed for one-handed phone use; minimum tap target 44 px.

**Google Calendar feed.** A per-user iCalendar (`.ics`) URL keyed on the user's chosen filter. Subscribing in Google Calendar pulls events and refreshes per Google's own polling cadence (typically 4–24 hours). Each event maps one-to-one to a VEVENT with `SUMMARY`, `DTSTART`, `DTEND`, `LOCATION` (from requirements field, first line if present), `DESCRIPTION`, and `CATEGORIES` (event type).

### 6.5 Filtering

Every output view exposes the same filter UI: a multi-select for grades, a multi-select for event types, and a free-text search over event names. Filters are reflected in the URL so filtered views can be shared. The default state is "all grades, all event types."

### 6.6 Academic-year handling

The active academic year runs September 1 to July 31 of the following calendar year. The system supports exactly one active year per tenant. At the administrator's request, a new year can be created; events from prior years remain readable but read-only.

### 6.7 Conflict detection (deferred to v1.1)

The advanced version warns when overlapping events appear illogical — e.g., a trip and an exam scheduled for the same grade on the same day. v1 records overlaps in the data but does not surface warnings.

## 7. Data model

The schema below uses generic types; the implementation may target PostgreSQL with `uuid` primary keys and `tenant_id` row-level security on all tables.

`tenants` — one row per school. Fields: id, name, locale (default `he-IL`), timezone (default `Asia/Jerusalem`), active_academic_year_id.

`academic_years` — id, tenant_id, label (e.g., "תשפ"ז 2026–27"), start_date, end_date.

`users` — id, tenant_id, email, password_hash, full_name, role (`editor` | `admin`), created_at.

`editor_scopes` — id, user_id, scope_kind (`grade` | `event_type`), scope_value. An editor may have many scope rows; the union defines what they can edit.

`event_types` — id, tenant_id, key (e.g., `pedagogical`, `exam`), label_he, label_en, color_hex, is_active.

`events` — id, tenant_id, academic_year_id, created_by_user_id, status (`draft` | `pending` | `approved` | `rejected`), title, event_type_id, date, all_day (bool), start_time, end_time, responsible_text, requirements_richtext, created_at, updated_at, approved_at, approved_by_user_id, rejected_reason.

`event_grades` — event_id, grade (enum: 7–12). Composite primary key. One row per grade the event applies to.

`event_revisions` — id, event_id, snapshot (JSONB of the event at submission time), submitted_at, submitted_by_user_id, decided_at, decided_by_user_id, decision (`approved` | `rejected`), reason. Drives the approval audit log.

`ical_subscriptions` — id, token (random 32-byte URL-safe), filter_grades (array), filter_event_types (array), created_at, last_fetched_at. Tokens are revocable.

## 8. API surface (REST)

All endpoints are under `/api/v1`, scoped to the authenticated user's tenant via session cookie. Viewer endpoints accept an optional tenant slug in the path.

Public viewer endpoints are `GET /tenants/:slug/events` (with `grades`, `types`, `q` query params), `GET /tenants/:slug/event-types`, `GET /tenants/:slug/academic-year`, and `GET /ical/:token` (returns `text/calendar`).

Authenticated endpoints are `POST /auth/login`, `POST /auth/logout`, `POST /auth/password-reset`, `GET /me`, `GET /events?status=pending|approved`, `POST /events` (creates draft or submits, depending on `status` field), `PATCH /events/:id`, `POST /events/:id/submit`, `POST /events/:id/approve` (admin), `POST /events/:id/reject` (admin), `GET /users` (admin), `POST /users` (admin), `PATCH /users/:id` (admin), `POST /users/:id/scopes` (admin), `GET /event-types` and `PATCH /event-types/:id` (admin), `POST /ical-subscriptions`, `DELETE /ical-subscriptions/:id`.

All write endpoints return the updated resource and a `Last-Modified` header to support optimistic UI.

## 9. Screens

The viewer-facing surface is a single SPA with route-driven views: `/` (Gantt), `/calendar` (yearly calendar), `/agenda` (mobile-first vertical), and a shared filter bar pinned to the top.

The editor surface adds `/dashboard` (my events, grouped by status), `/events/new` (the seven-step wizard), `/events/:id/edit`, and `/profile`.

The administrator surface adds `/admin/queue` (pending events with one-click Approve / Reject), `/admin/users` (editor management with scope assignment), `/admin/event-types` (color and label configuration), and `/admin/year` (academic year setup and rollover).

All screens are RTL-first with LTR mirroring available via a user preference. Hebrew is the default UI language; English is a runtime toggle.

## 10. Integrations

**Google Calendar.** Implemented as a per-subscription iCalendar feed (read-only from Google's perspective). Users generate a token from `/profile`, configure a filter, and paste the URL into Google Calendar's "From URL" subscription. No OAuth required for v1; OAuth-based two-way sync is a v2 candidate.

**גפן (Gefen) — Israeli Ministry of Education catalog.** v1 captures the integration only as a placeholder: the tenant settings include a `gefen_listing_id` field and a "request listing" CTA. Actual catalog integration (allowing the Ministry to pay on the school's behalf) is procedural rather than technical and is tracked outside the engineering scope.

## 11. Non-functional requirements

The product is RTL-first, Hebrew-default, with full Unicode support including Hebrew nikud. Server timezone is `Asia/Jerusalem` and date boundaries respect Hebrew calendar where relevant for vacation dates (the system stores Gregorian dates but rendering surfaces may show parallel Hebrew dates).

Performance targets: Gantt view loads under 2 seconds with up to 1,000 events; printable calendar renders under 3 seconds; iCalendar feed responds in under 500 ms for up to 1,000 events. The system targets 99.9% availability outside scheduled maintenance windows.

Accessibility: WCAG 2.1 AA. Color is never the only signal — event types also carry a glyph or pattern visible in monochrome printing and to color-blind users. All interactive elements are keyboard-reachable. The mobile view passes Lighthouse Accessibility ≥ 95.

Data: every approved event change is captured in `event_revisions` for an immutable audit trail. Events are soft-deleted; hard delete requires administrator action and is logged.

Browser support: latest two major versions of Chrome, Safari, Firefox, and Edge. iOS Safari 15+ and Chrome on Android 11+.

## 12. Edge cases and open questions

The Gantt view's representation of multi-grade events needs design input — single bar across multiple rows, duplicated bars, or a stacked-row treatment.

When an editor's scope is revoked, their pending events should remain in the queue (admin decides) but they should lose the ability to edit them. Confirm with stakeholders.

When two editors edit the same event concurrently, the system uses last-write-wins on PATCH but warns via `If-Match` ETag mismatch. UX for the conflict resolution screen is unspecified.

The source brief mentions "vacations" coming from the Ministry of Education. v1 expects an administrator to enter these manually; an automated import from a Ministry feed is a v1.1 candidate if such a feed exists.

iCalendar tokens leak privacy if shared. We rotate them on user request and on password reset; we do not currently expire them automatically.

## 13. Phasing

**v1.0 (MVP).** Authentication, the seven-step wizard, the approval queue, all four output views, filtering, iCalendar feed, single-school deployment, Hebrew UI.

**v1.1.** Date ranges, staff picker for "responsible person," Ministry vacation import (if feed exists), conflict warnings.

**v2.0.** Two-way Google Calendar sync via OAuth, multi-tenant administrator dashboard, English UI parity, parent-facing mobile app shell.

## 14. Acceptance criteria (per major capability)

**Authentication.** A user can register an editor account via admin invitation and log in within 30 seconds. Failed login attempts above the threshold trigger lockout. Password reset emails arrive within one minute.

**Event creation.** An editor can complete the wizard end-to-end in under 60 seconds for a typical event. Drafts persist across sessions for at least seven days. Submitted events appear in the admin queue within five seconds.

**Approval.** An administrator can approve or reject from the queue in one click (plus a reason for rejection). Approved events appear in all output views within five seconds.

**Output views.** Each view renders the same event with consistent color, title, and time. Filter state persists across views and is preserved in the URL.

**iCalendar.** Subscribing to an iCalendar URL in Google Calendar reflects new events on Google's standard refresh cadence. Tokens can be revoked and revoked tokens return HTTP 404 within one minute.

**Print.** The printable calendar produces a one-page-per-month PDF on A4 with all event chips legible at default zoom.

**Accessibility.** All wizard steps are completable with keyboard only. Event-type color is paired with a non-color glyph everywhere it appears.

---

*End of document.*
