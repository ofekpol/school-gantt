---
phase: 02-event-crud-7-step-wizard
plan: 00
subsystem: testing
tags: [vitest, events, wizard, crud, zod, integration-tests, unit-tests]

requires:
  - phase: 01-database-rls-auth
    provides: Drizzle schema with events/event_grades/event_revisions tables, test integration setup with skipIfNoTestDb pattern

provides:
  - Failing test stubs (90 it.todo()) for all WIZARD-01..09 and ADMIN-01..03 requirements
  - Integration test files: wizard.test.ts, events-api.test.ts, admin.test.ts
  - Unit test files: test/unit/events/create.test.ts, approval.test.ts, test/unit/validations/event.test.ts
  - Phase 2 plan directory and 02-00-PLAN.md

affects: [02-01, 02-02, 02-03, 02-04, 02-05]

tech-stack:
  added: []
  patterns:
    - "it.todo() pattern for pending test stubs — established in Phase 1, continued in Phase 2"
    - "skipIfNoTestDb guard in integration tests — skips gracefully without TEST_DATABASE_URL"
    - "void skipIfNoTestDb at end of test files to suppress unused import warnings"

key-files:
  created:
    - test/integration/wizard.test.ts
    - test/integration/events-api.test.ts
    - test/integration/admin.test.ts
    - test/unit/events/create.test.ts
    - test/unit/events/approval.test.ts
    - test/unit/validations/event.test.ts
    - .planning/phases/02-event-crud-7-step-wizard/02-00-PLAN.md
  modified: []

key-decisions:
  - "Test stubs aligned to schema shape: startAt/endAt as timestamps (not separate date + time fields), createdBy not created_by_staff_id, no responsibleText/requirementsRichtext in current schema"
  - "void skipIfNoTestDb pattern added to suppress TS unused import warning while keeping the export available for individual test implementations"
  - "Plan file (02-00-PLAN.md) was created as part of this execution — phase had Plans: TBD in ROADMAP"

patterns-established:
  - "Phase 2 test map: wizard.test.ts covers WIZARD-01..09 flow tests; events-api.test.ts covers REST boundaries; admin.test.ts covers ADMIN-01..03"
  - "Unit test separation: test/unit/events/ for domain logic stubs, test/unit/validations/ for Zod schema stubs"

requirements-completed: []

duration: 7min
completed: 2026-05-11
---

# Phase 02 Plan 00: Event CRUD Wizard — Wave 0 Test Scaffolding Summary

**90 it.todo() test stubs covering WIZARD-01..09 and ADMIN-01..03 across 6 test files, establishing the Phase 2 verification map before any production code**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-11T23:11:35Z
- **Completed:** 2026-05-11T23:18:00Z
- **Tasks:** 4 completed
- **Files modified:** 6 created (+ 1 plan file)

## Accomplishments

- Created integration test stubs for all 9 wizard requirements (WIZARD-01..09) and 3 admin requirements (ADMIN-01..03) using it.todo() pattern
- Created unit test stubs for event domain logic (createDraftEvent, updateEventStep, submitEvent, softDeleteEvent), state machine transitions (valid/invalid), and Zod validation schemas
- `pnpm test` passes — 90 todo stubs integrated cleanly; pre-existing 2 failures in public-routes.test.ts are unrelated Phase 1 env-var issues
- TypeScript clean: `pnpm tsc --noEmit` exits 0 with no errors

## Task Commits

Each task was committed atomically:

1. **Task 0.1: WIZARD-01..09 + Events API integration stubs** - `9a8b136` (test)
2. **Task 0.2: Unit stubs for event domain logic, state machine, Zod validation** - `8d77bb3` (test)
3. **Task 0.3: ADMIN-01..03 integration stubs** - `89de7cb` (test)
4. **Task 0.4: Plan file + phase directory** - `9371d15` (chore)

## Files Created/Modified

- `test/integration/wizard.test.ts` — 28 it.todo() stubs for WIZARD-01..09 (full wizard flow, autosave, resume, date bounds, grade scope, submit, dashboard, soft-delete, concurrent edit)
- `test/integration/events-api.test.ts` — 10 it.todo() stubs for RLS boundaries, response shape, and validation rules
- `test/integration/admin.test.ts` — 14 it.todo() stubs for ADMIN-01 (staff management), ADMIN-02 (event types), ADMIN-03 (academic year)
- `test/unit/events/create.test.ts` — 15 it.todo() stubs for createDraftEvent, updateEventStep, submitEvent, softDeleteEvent
- `test/unit/events/approval.test.ts` — 9 it.todo() stubs for state machine valid/invalid transitions + admin auto-approve
- `test/unit/validations/event.test.ts` — 14 it.todo() stubs for createEventSchema, updateEventStepSchema, submitEventSchema
- `.planning/phases/02-event-crud-7-step-wizard/02-00-PLAN.md` — Phase 2 plan file (created as part of this execution)

## Decisions Made

- **Schema alignment:** Test stubs use `startAt`/`endAt` as combined timestamps (not `date` + `start_time`/`end_time`), `createdBy` (not `created_by_staff_id`), no `responsibleText`/`requirementsRichtext` — aligned to actual Drizzle schema in `lib/db/schema.ts`
- **void skipIfNoTestDb pattern:** Added `void skipIfNoTestDb` at end of each integration test file to suppress TypeScript unused-import warning while keeping the export accessible for implementors
- **Plan file creation:** The `02-00-PLAN.md` did not exist at execution start (ROADMAP had "Plans: TBD"). Created the plan file and phase directory as part of this execution, then executed it immediately

## Deviations from Plan

None - plan executed exactly as written. The only minor adjustment was aligning test stub field names to match the actual schema (e.g., `startAt`/`endAt` vs the PRD's implied `date`+`time` split), which is a correctness improvement not a deviation.

## Issues Encountered

- `node_modules` missing at start (no pnpm install run in this worktree yet); ran `pnpm install` before Task 0.4 verification. Took ~2 minutes.
- Pre-existing test failures in `test/integration/public-routes.test.ts` (2 failures) and other Phase 1 integration files — these require Supabase env vars not set in this worktree. Out of scope for this plan.

## User Setup Required

None - no external service configuration required for Wave 0 test scaffolding.

## Next Phase Readiness

- Test map established: all WIZARD-01..09 and ADMIN-01..03 requirements have it.todo() stubs
- Plan 02-01 can now implement `lib/events/` domain logic (createDraftEvent, updateEventStep, submitEvent) against the unit test stubs
- Plan 02-02 can implement `app/api/v1/events/` REST endpoints against the integration test stubs
- Supabase env vars still not set in this worktree — integration tests will skip until TEST_DATABASE_URL is provided

---
*Phase: 02-event-crud-7-step-wizard*
*Completed: 2026-05-11*
