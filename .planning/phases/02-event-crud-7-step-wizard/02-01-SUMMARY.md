---
phase: 02-event-crud-7-step-wizard
plan: 01
subsystem: api

requires:
  - phase: 02-event-crud-7-step-wizard
    plan: 00
    provides: test stubs for WIZARD-01..09

provides:
  - Event domain layer: lib/events/crud.ts, lib/events/approval.ts, lib/events/queries.ts
  - Zod schemas: lib/validations/events.ts
  - REST routes: POST/GET /api/v1/events, GET/PATCH/DELETE /api/v1/events/[id], POST /api/v1/events/[id]/submit

affects: [02-02]

tech-stack:
  added: []
  patterns:
    - "If-Match header for optimistic concurrency — PATCH returns 409 on version mismatch"
    - "createDraft → immediate event row + redirect to /events/[id]/edit pattern"
    - "withSchool() wraps all queries; db directly for schools table (no RLS)"

key-files:
  created:
    - lib/events/crud.ts
    - lib/events/approval.ts
    - lib/events/queries.ts
    - lib/validations/events.ts
    - app/api/v1/events/route.ts
    - app/api/v1/events/[id]/route.ts
    - app/api/v1/events/[id]/submit/route.ts
  modified:
    - test/integration/wizard.test.ts
    - test/integration/events-api.test.ts

key-decisions:
  - "PATCH uses If-Match header for version CAS — returns {status:'conflict', currentVersion} on mismatch"
  - "getDefaultEventType uses db directly on schools (no RLS on schools table)"
  - "submitForApproval writes event_revisions row via lib/events/approval.ts state machine"

patterns-established:
  - "All event status transitions go through lib/events/approval.ts — never direct status writes"
  - "API routes return camelCase; DB columns snake_case transformed at route layer"

requirements-completed:
  - WIZARD-01
  - WIZARD-02
  - WIZARD-05
  - WIZARD-06
  - WIZARD-08
  - WIZARD-09

duration: 20min
completed: 2026-05-12
---

# Phase 02 Plan 01: Event REST API

**Event CRUD REST surface: POST create draft, PATCH autosave with If-Match concurrency, DELETE soft-delete, POST submit. Domain layer + Zod schemas + integration tests.**

## What was built

- `lib/events/crud.ts` — `createDraft`, `updateDraft` (version CAS), `softDeleteEvent`
- `lib/events/approval.ts` — `submitForApproval` state machine transition
- `lib/events/queries.ts` — `getEditorAllowedGrades`, `getEditorDashboardEvents`, `getEventForEditor`, `getActiveAcademicYear`, `getDefaultEventType`
- `lib/validations/events.ts` — `EventDraftSchema` (partial), `EventSubmitSchema` (required fields)
- `app/api/v1/events/route.ts` — `GET` (dashboard list), `POST` (create draft)
- `app/api/v1/events/[id]/route.ts` — `GET`, `PATCH` (autosave + CAS), `DELETE` (soft)
- `app/api/v1/events/[id]/submit/route.ts` — `POST` (draft → pending transition)

## Self-Check: PASSED
