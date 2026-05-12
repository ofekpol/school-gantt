---
phase: 02-event-crud-7-step-wizard
verified: 2026-05-12T00:00:00Z
status: gaps_found
score: 6/8 must-haves verified
gaps:
  - truth: "getDefaultEventType(schoolId) returns the lowest-sortOrder event_type row (or null) so the wizard entry point can call it without bypassing lib/"
    status: failed
    reason: "Function never implemented in lib/events/queries.ts. app/(staff)/events/new/page.tsx queries event types with a direct withSchool + schema import, bypassing the domain library layer entirely."
    artifacts:
      - path: "lib/events/queries.ts"
        issue: "Missing export async function getDefaultEventType — required by must_haves.artifacts.exports list"
      - path: "app/(staff)/events/new/page.tsx"
        issue: "Imports withSchool, academicYears, editorScopes, eventTypes, schools, events directly from lib/db — violates CLAUDE.md 'every query that touches school data must run inside db.withSchool through lib/'"
    missing:
      - "Add getDefaultEventType(schoolId) to lib/events/queries.ts"
      - "Refactor new/page.tsx to use getActiveAcademicYear, getEditorAllowedGrades, and getDefaultEventType from lib/events/queries.ts instead of inline DB queries"

  - truth: "getEditorDashboardEvents returns the editor's draft + pending events filtered by createdBy and excluding soft-deleted rows"
    status: partial
    reason: "Function exists and is correctly implemented in lib/events/queries.ts, but app/(staff)/dashboard/page.tsx is ORPHANED — it ignores this function and runs its own inline withSchool query with different logic (includes 'rejected' status unlike the library function, missing schoolId eq filter redundancy)."
    artifacts:
      - path: "app/(staff)/dashboard/page.tsx"
        issue: "Bypasses getEditorDashboardEvents. Imports withSchool and events schema directly. The inline query includes 'rejected' in status filter while getEditorDashboardEvents only returns ['draft','pending'] — behavioral divergence."
      - path: "lib/events/queries.ts"
        issue: "getEditorDashboardEvents is ORPHANED — exported but never imported outside lib/"
    missing:
      - "Refactor dashboard/page.tsx to call getEditorDashboardEvents from lib/events/queries.ts"
      - "If rejected events on the dashboard are intentional, update getEditorDashboardEvents to include 'rejected' status and document the decision"

  - truth: "createDraft returns {id, version: 1} and the row is observable in events table with status='draft' — export contract includes replaceEventGrades as a standalone top-level export"
    status: partial
    reason: "replaceEventGrades is implemented inline inside updateDraft but is NOT exported as a top-level function. The must_haves.artifacts.exports list explicitly requires this export. Plan 00 acceptance criterion also checks for 'export async function replaceEventGrades('."
    artifacts:
      - path: "lib/events/crud.ts"
        issue: "Missing top-level export: replaceEventGrades. Grade replacement logic exists inside updateDraft transaction but is not independently callable."
    missing:
      - "Extract the inline grades replacement logic into an exported replaceEventGrades(schoolId, eventId, grades) function"
---

# Phase 2: Event CRUD & 7-Step Wizard — Verification Report

**Phase Goal:** A staff editor can create, autosave, resume, and submit an event for approval entirely through the UI
**Verified:** 2026-05-12
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | createDraft(schoolId, userId, eventTypeId) returns {id, version:1} with status='draft' | VERIFIED | lib/events/crud.ts:12-33, wired to POST /api/v1/events |
| 2 | updateDraft with matching expectedVersion returns {status:'ok', version:v+1}; stale returns {status:'conflict'} | VERIFIED | lib/events/crud.ts:57-118 CAS logic + version increment; wired to PATCH /api/v1/events/[id] with If-Match header |
| 3 | submitForApproval flips draft→pending and inserts event_revisions row with decision='submitted' | VERIFIED | lib/events/approval.ts:14-41; wired to POST /api/v1/events/[id]/submit |
| 4 | getEditorAllowedGrades returns grade scopes; returns [7..12] for editors with zero grade scopes | VERIFIED | lib/events/queries.ts:39-56; wired to PATCH /api/v1/events/[id] scope check |
| 5 | getActiveAcademicYear returns active year or null | VERIFIED | lib/events/queries.ts:16-32; wired to POST /api/v1/events route + admin year page |
| 6 | getEditorDashboardEvents returns editor's draft+pending events filtered by createdBy, excluding deleted | PARTIAL | Function exists in lib/events/queries.ts:72-97 but dashboard/page.tsx ignores it, running its own inline query. Function is ORPHANED. |
| 7 | getDefaultEventType(schoolId) returns lowest-sortOrder event_type row or null | FAILED | Function absent from lib/events/queries.ts. new/page.tsx queries event types directly via raw withSchool+schema imports. |
| 8 | Migration 0002 adds FK schools.active_academic_year_id → academic_years.id | VERIFIED | db/migrations/0002_schools_active_year_fk.sql exists with correct ALTER TABLE + DEFERRABLE constraint |

**Score:** 6/8 truths verified (2 failed/partial)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| lib/validations/events.ts | EventDraftSchema (all-optional) + EventSubmitSchema (strict) | VERIFIED | Both schemas exported; EventDraftSchema all fields optional; EventSubmitSchema requires title, dates, eventTypeId, grades |
| lib/validations/admin.ts | StaffUserCreateSchema, StaffUserUpdateSchema, EventTypeSchema, AcademicYearSchema | VERIFIED | All four schemas exported with correct field types |
| lib/events/crud.ts | createDraft, updateDraft, softDelete, replaceEventGrades, UpdateDraftResult | PARTIAL | createDraft, updateDraft, softDelete, UpdateDraftResult all present. replaceEventGrades NOT exported as top-level function — inline only. |
| lib/events/approval.ts | submitForApproval state machine + revision write | VERIFIED | submitForApproval exported; writes eventRevisions row with decision='submitted'; also contains approveEvent and rejectEvent (Phase 3 preview) |
| lib/events/queries.ts | getEditorAllowedGrades, getActiveAcademicYear, getEditorDashboardEvents, getEventForEditor, getDefaultEventType | PARTIAL | First four functions exported and implemented. getDefaultEventType MISSING. |
| lib/db/staff.ts | createStaffUser (auth.admin.createUser), deactivateStaffUser, listStaffUsers | VERIFIED | createStaffUser calls supabaseAdmin.auth.admin.createUser; updateStaffUser calls signOut on deactivation; listStaffUsers exported |
| db/migrations/0002_schools_active_year_fk.sql | FK schools.active_academic_year_id → academic_years.id | VERIFIED | File present; uses DO $$ IF NOT EXISTS guard; ON DELETE SET NULL; DEFERRABLE INITIALLY DEFERRED |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| lib/events/approval.ts | events + event_revisions | withSchool transaction insert | WIRED | Line 19: withSchool wraps both the status update and eventRevisions insert atomically |
| lib/events/crud.ts updateDraft | events.version compare-and-swap | WHERE version = clientVersion + increment | WIRED | Lines 81-89: expectedVersion check + updateSet.version = current.version + 1 |
| lib/db/staff.ts createStaffUser | supabaseAdmin.auth.admin.createUser | two-phase: Auth then DB insert | WIRED | Line 60: auth.admin.createUser called first; authId used for staff_users insert in withSchool |
| WizardShell | POST /api/v1/events (create) | fetch + setEventId | WIRED | WizardShell.tsx:88-96: fetch POST on first save, returns {id} |
| WizardShell | PATCH /api/v1/events/[id] (autosave) | fetch with eventId | WIRED | WizardShell.tsx:99-105: PATCH on subsequent steps |
| Step7Summary onSubmit | POST /api/v1/events/[id]/submit | handleSubmit → onSubmit prop | WIRED | WizardShell.tsx:128; Step7Summary.tsx:30-38 |
| StaffTable | POST /api/v1/admin/staff | fetch POST | WIRED | StaffTable.tsx:48 |
| YearForm | POST /api/v1/admin/years, PATCH /api/v1/admin/years/[id] | fetch POST/PATCH | WIRED | YearForm.tsx:45, 60 |
| EventTypeTable | POST/PATCH/DELETE /api/v1/admin/event-types | fetch calls | WIRED | EventTypeTable.tsx:58, 76, 89 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| app/(staff)/dashboard/page.tsx | myEvents | withSchool inline query (events table) | Yes — DB query with status filter | FLOWING (but bypasses lib/) |
| app/(staff)/events/new/page.tsx | eventTypeList, yearBounds, allowedGrades | withSchool inline queries (multiple tables) | Yes — real DB queries | FLOWING (but bypasses lib/) |
| app/(admin)/admin/staff/page.tsx | staff, eventTypes | listStaffUsers, listEventTypes | Yes — DB queries via domain helpers | FLOWING |
| app/(admin)/admin/year/page.tsx | years, active | listAcademicYears, getActiveAcademicYear | Yes — DB queries via domain helpers | FLOWING |
| app/(admin)/admin/event-types/page.tsx | eventTypes | listEventTypes | Yes — DB query via domain helper | FLOWING |
| components/wizard/WizardShell.tsx | eventId, data | POST/PATCH API + props from server page | Yes — real API responses | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points available without live DB credentials.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WIZARD-01 | 02-00, 02-01, 02-02 | Staff editor can create event via 7-step wizard | SATISFIED | WizardShell + all 7 step components exist and wire to API |
| WIZARD-02 | 02-00, 02-01, 02-02 | Wizard autosaves draft on every step | SATISFIED | WizardShell.tsx handleNext calls save() which PATCH es API after each step |
| WIZARD-03 | 02-02 | Editor can close tab and resume draft from /dashboard | SATISFIED | Dashboard shows drafts with "Continue" link (?resumeId=); new/page.tsx loads resumeDraft from DB |
| WIZARD-04 | 02-00, 02-02 | Date picker bounded by active academic year | SATISFIED | Step1Date.tsx uses min/max props from yearBounds; yearBounds loaded server-side |
| WIZARD-05 | 02-00, 02-01, 02-02 | Grade multi-select respects editor grade scopes | SATISFIED | Step2Grades.tsx renders only allowedGrades prop; PATCH route validates grades against getEditorAllowedGrades |
| WIZARD-06 | 02-00, 02-01, 02-02 | Step 7 Submit flips draft→pending | SATISFIED | Step7Summary submit → WizardShell handleSubmit → POST /api/v1/events/[id]/submit → submitForApproval |
| WIZARD-07 | 02-02 | Dashboard shows draft+pending events with status indicators | PARTIAL | Dashboard exists with StatusBadge. Uses inline query including 'rejected' events. getEditorDashboardEvents orphaned. Dashboard functions but doesn't use the domain library. |
| WIZARD-08 | 02-01, 02-02 | Editor can soft-delete their own draft events | SATISFIED | softDelete in lib/events/crud.ts; DELETE /api/v1/events/[id] route. Note: UI delete button not visible in dashboard page, only in wizard — human verification needed. |
| WIZARD-09 | 02-00, 02-01, 02-02 | Concurrent edit: If-Match / version check; conflict response | SATISFIED | PATCH route reads If-Match header; updateDraft returns {status:'conflict'} on mismatch |
| ADMIN-01 | 02-03, 02-04 | Admin can manage staff users at /admin/staff | SATISFIED | /admin/staff page + StaffTable client component + POST/PATCH /api/v1/admin/staff routes + assertAdmin guard |
| ADMIN-02 | 02-03, 02-04 | Admin can configure event types at /admin/event-types | SATISFIED | /admin/event-types page + EventTypeTable + full CRUD API routes |
| ADMIN-03 | 02-03, 02-04 | Admin can configure active academic year at /admin/year | SATISFIED | /admin/year page + YearForm + POST/PATCH API routes + setActiveYear in lib/admin/years.ts |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app/(staff)/events/new/page.tsx | 1-12 | Imports withSchool, academicYears, editorScopes, eventTypes, schools, events directly — bypasses lib/events/queries.ts | Warning | Violates CLAUDE.md "every query that touches school data must run inside db.withSchool through lib/". Creates maintenance debt; domain logic diverges from library functions. |
| app/(staff)/dashboard/page.tsx | 1-6 | Imports withSchool and events schema directly — bypasses getEditorDashboardEvents | Warning | Same architecture violation. Additionally, the inline query includes 'rejected' status while getEditorDashboardEvents only returns ['draft','pending'] — behavioral divergence between library contract and UI. |
| lib/events/create.ts | 1-114 | Parallel implementation of createDraft/updateDraft/softDelete — duplicates lib/events/crud.ts | Warning | Two domain layers for the same concern. API routes use crud.ts; Plan 02 created create.ts. No consumers currently use create.ts (wizard submits through the API which uses crud.ts). Dead code risk. |
| lib/events/submit.ts | 1-53 | Parallel implementation of submitForApproval — duplicates lib/events/approval.ts | Warning | Same issue as create.ts. submit.ts is not imported by any route handler — the API submit route uses lib/events/approval.ts. |
| lib/validations/event.ts | 1 | Parallel validation schema file alongside lib/validations/events.ts | Info | Two validation files: events.ts (used by API routes) and event.ts (Plan 02 wizard layer, used by create.ts/submit.ts). Only events.ts is wired into production API routes. |

**Stub classification note:** lib/events/create.ts and lib/events/submit.ts exist but are NOT imported by any active route handler. The REST API routes (which the WizardShell calls) use lib/events/crud.ts and lib/events/approval.ts exclusively. create.ts and submit.ts are dead code as of this phase.

---

### Human Verification Required

#### 1. Soft-delete UI trigger

**Test:** Log in as editor, open the dashboard, find a draft event — verify a delete button is present and clicking it soft-deletes the event (it disappears from the list).
**Expected:** Draft event disappears from dashboard after delete. Non-draft events have no delete button.
**Why human:** Dashboard page code has no delete button rendered. The API route exists (DELETE /api/v1/events/[id]) but no UI trigger is visible in dashboard/page.tsx. Either the button is in WizardShell or it is missing from the UI.

#### 2. Wizard autosave conflict toast (WIZARD-09)

**Test:** Open the same draft in two browser tabs. Advance step in tab 1. Then advance a step in tab 2 (stale version).
**Expected:** Tab 2 shows a toast/warning that a conflict was detected.
**Why human:** WizardShell.tsx does not implement conflict toast — the PATCH returns 409 but WizardShell.tsx line 104 only checks `if (!res.ok) throw new Error("Failed to save step")`. No conflict toast is rendered to the user. This is a potential WIZARD-09 gap that needs human confirmation.

#### 3. RTL layout correctness across all wizard steps and admin pages

**Test:** Navigate each wizard step and each admin page in a Hebrew RTL browser. Verify text alignment, button placement, and form field direction are correct.
**Expected:** All UI elements respect RTL (text-start/text-end, ms-/me-, ps-/pe- Tailwind classes).
**Why human:** Code uses logical CSS properties throughout, but visual verification required to confirm no layout breakage.

#### 4. WIZARD-03 resume with populated step data

**Test:** Complete steps 1-4, close the browser, reopen /dashboard, click "Continue" on the draft.
**Expected:** Wizard opens at step 1 with the previously saved title, event type, and grades pre-filled.
**Why human:** WizardShell.tsx initializes state from resumeDraft prop (title, startAt, endAt, allDay, eventTypeId) but does NOT restore date, grades, or responsibleText/requirementsText. The resume is partial — steps that depend on date or grades fields will appear empty even though the DB has them.

---

### Gaps Summary

Three gaps block full goal certification:

**Gap 1 — getDefaultEventType missing (FAILED):** The must_haves require `getDefaultEventType` in `lib/events/queries.ts` to keep the wizard entry page off raw schema imports. The function was never implemented. `app/(staff)/events/new/page.tsx` instead queries `eventTypes`, `academicYears`, `editorScopes`, `schools`, and `events` tables directly with `withSchool`, violating the CLAUDE.md layering rule. This is an architecture cleanliness gap rather than a functional gap — the wizard works — but it creates a maintenance risk and violates the stated constraint.

**Gap 2 — getEditorDashboardEvents orphaned (PARTIAL):** The function is correctly implemented in `lib/events/queries.ts` but never called. `dashboard/page.tsx` runs its own inline query with different semantics (includes 'rejected' status, missing the lib function's `orderBy desc(updatedAt)` spec). The behavioral divergence means the dashboard contract differs from what the library function documents.

**Gap 3 — replaceEventGrades not a top-level export (PARTIAL):** The must_haves explicitly require `replaceEventGrades` as a standalone exported function (for external callers and testability). The grade replacement logic is correctly implemented inline within `updateDraft` but is not independently callable. This was a plan acceptance criterion that was not met.

**Architecture observation:** Phase 2 executed as two separate waves. Plan 00/01 built `lib/events/crud.ts + approval.ts + queries.ts`. Plan 02 built a parallel layer (`lib/events/create.ts + submit.ts + lib/validations/event.ts`). The REST API routes (which WizardShell calls) use the Plan 00/01 layer. The Plan 02 layer files (`create.ts`, `submit.ts`) are currently dead code — they are not imported by any route handler or page. This duplication should be resolved: either remove the Plan 02 layer or reroute the Plan 02 files to replace the Plan 00/01 files.

---

_Verified: 2026-05-12_
_Verifier: Claude (gsd-verifier)_
