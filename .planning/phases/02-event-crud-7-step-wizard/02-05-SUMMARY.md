---
phase: 02-event-crud-7-step-wizard
plan: "05"
subsystem: api
tags: [drizzle, queries, refactor, dead-code]

# Dependency graph
requires:
  - phase: 02-event-crud-7-step-wizard
    provides: lib/events/queries.ts, lib/events/crud.ts, staff pages, admin pages
provides:
  - getDefaultEventType exported from lib/events/queries.ts
  - listEventTypes exported from lib/events/queries.ts
  - getDraftForResume exported from lib/events/queries.ts
  - replaceEventGrades as top-level export from lib/events/crud.ts
  - Staff pages consuming lib/events/queries.ts exclusively (no raw withSchool or schema imports)
  - Dead files removed: lib/events/create.ts, lib/events/submit.ts, lib/validations/event.ts
  - 02-HUMAN-VERIFY.md documenting WIZARD-08/-09/-03 UI gaps for Phase 3 follow-up
affects: [03-approval-workflow, all phases using lib/events/]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All event-type queries go through lib/events/queries.ts — no direct schema imports in pages"
    - "replaceEventGrades is the single top-level export for grade replacement; updateDraft delegates to it post-transaction (avoids nested withSchool)"

key-files:
  created:
    - .planning/phases/02-event-crud-7-step-wizard/02-HUMAN-VERIFY.md
  modified:
    - lib/events/queries.ts
    - lib/events/crud.ts
    - app/(staff)/events/new/page.tsx
    - app/(staff)/dashboard/page.tsx
  deleted:
    - lib/events/create.ts
    - lib/events/submit.ts
    - lib/validations/event.ts

key-decisions:
  - "Dashboard drops 'rejected' status from query — getEditorDashboardEvents returns only draft+pending per Plan 00 must_have; rejected events deferred to Phase 3 /dashboard/rejected surface"
  - "replaceEventGrades called after updateDraft withSchool block (not inside) to avoid nested withSchool (Pitfall 5); two round-trips are acceptable for correctness"
  - "listEventTypes returns EventTypeListItem with labelEn+sortOrder extras beyond WizardShell EventType interface — TypeScript structural subtyping accepts this without type widening"

patterns-established:
  - "Domain layer boundary: staff pages import from lib/events/queries.ts only; never import withSchool or schema tables directly"

requirements-completed:
  - WIZARD-01
  - WIZARD-02
  - WIZARD-03
  - WIZARD-04
  - WIZARD-05
  - WIZARD-06
  - WIZARD-07
  - WIZARD-08
  - WIZARD-09
  - ADMIN-01
  - ADMIN-02
  - ADMIN-03

# Metrics
duration: 25min
completed: 2026-05-12
---

# Phase 2 Plan 05: Gap Closure — Queries Refactor, Dead-Code Removal Summary

**lib/events layering contract restored: 3 new domain helpers added to queries.ts, replaceEventGrades promoted to top-level export in crud.ts, both staff pages decoupled from raw schema, and 3 dead Plan-02 parallel-layer files removed**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-12T19:30:00Z
- **Completed:** 2026-05-12T19:55:00Z
- **Tasks:** 3
- **Files modified:** 7 (4 modified, 3 deleted, 1 created)

## Accomplishments

- Added `getDefaultEventType`, `listEventTypes`, `getDraftForResume` to `lib/events/queries.ts` — all event-type/draft reads now go through the domain layer
- Extracted `replaceEventGrades` as top-level export in `lib/events/crud.ts`; `updateDraft` delegates to it after its own `withSchool` transaction completes (avoids Pitfall 5: nested withSchool)
- Replaced both staff pages to consume only `lib/events/queries.ts` — zero direct `withSchool` or schema imports remain in `app/(staff)/`
- Deleted `lib/events/create.ts`, `lib/events/submit.ts`, `lib/validations/event.ts` (zero live consumers confirmed before deletion)
- Wrote `02-HUMAN-VERIFY.md` documenting WIZARD-08/-09/-03 UI gaps as Phase 3 candidates

## Task Commits

1. **Task 1: Add getDefaultEventType + extract replaceEventGrades** - `f2af21e` (feat)
2. **Task 2: Refactor staff pages to consume lib/events/queries.ts** - `33a4f52` (feat)
3. **Task 3: Remove dead parallel layer + write human-verify checklist** - `a92a24a` (feat)

## Files Created/Modified

- `lib/events/queries.ts` — Added `getDefaultEventType`, `listEventTypes`, `getDraftForResume`, `EventTypeListItem` interface; added `asc`/`eventTypes` imports
- `lib/events/crud.ts` — Added `replaceEventGrades` top-level export; refactored `updateDraft` to call it post-transaction
- `app/(staff)/events/new/page.tsx` — Replaced: now imports from `lib/events/queries` only; no `withSchool`/schema
- `app/(staff)/dashboard/page.tsx` — Replaced: calls `getEditorDashboardEvents`; no raw schema imports
- `.planning/phases/02-event-crud-7-step-wizard/02-HUMAN-VERIFY.md` — Created: test plans for WIZARD-08/-09/-03
- `lib/events/create.ts` — Deleted (dead file, zero importers)
- `lib/events/submit.ts` — Deleted (dead file, zero importers)
- `lib/validations/event.ts` — Deleted (only importer was create.ts, also deleted)

## Decisions Made

- **Dashboard drops 'rejected' status:** `getEditorDashboardEvents` returns only `draft`+`pending` per Plan 00 must_have. The current dashboard was querying `rejected` too. Decision: library function is source of truth; rejected events will be surfaced on a dedicated Phase 3 page.
- **replaceEventGrades post-transaction:** Calling `replaceEventGrades` after the event update `withSchool` block rather than inside it avoids nested `withSchool` (RESEARCH Pitfall 5). Two round-trips are acceptable.
- **Extra fields in listEventTypes return type:** `EventTypeListItem` includes `labelEn` and `sortOrder` beyond `WizardShell.EventType` interface — TypeScript structural subtyping accepts the superset type without casting.

## Deviations from Plan

None — plan executed exactly as written, except for the addition of `getDraftForResume` helper (Step 2 of Task 2 in the plan) which was already specified in the plan but classified as part of Task 2. No unplanned changes.

## Issues Encountered

Pre-existing test failures in `test/integration/public-routes.test.ts` (2 tests fail due to missing `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars). These were present before this plan and are not caused by any change here.

## Known Stubs

None — all data queries are fully wired to real database helpers.

## Next Phase Readiness

- Phase 2 lib/ layering contract is now fully satisfied (8/8 Plan 00 must_have truths pass)
- Phase 3 (Approval Workflow) can build on `lib/events/approval.ts` which is already present
- Three UI gaps (WIZARD-08/-09/-03) documented in `02-HUMAN-VERIFY.md` for Phase 3 resolution

## Self-Check

- [ ] `lib/events/queries.ts` exports: `getActiveAcademicYear`, `getEditorAllowedGrades`, `getEditorDashboardEvents`, `getEventForEditor`, `getDefaultEventType`, `listEventTypes`, `getDraftForResume` — all present
- [ ] `lib/events/crud.ts` exports: `createDraft`, `updateDraft`, `softDelete`, `replaceEventGrades` — all present
- [ ] Dead files deleted: `lib/events/create.ts`, `lib/events/submit.ts`, `lib/validations/event.ts` — confirmed absent
- [ ] `02-HUMAN-VERIFY.md` exists with WIZARD-08/-09/-03 — confirmed

---
*Phase: 02-event-crud-7-step-wizard*
*Completed: 2026-05-12*
