---
phase: 02-event-crud-7-step-wizard
plan: 03
subsystem: api

requires:
  - phase: 02-event-crud-7-step-wizard
    plan: 00
    provides: test stubs for ADMIN-01..03

provides:
  - assertAdmin guard: lib/auth/admin.ts
  - Admin domain helpers: lib/admin/event-types.ts, lib/admin/years.ts, lib/db/staff.ts (extended)
  - Admin Zod schemas: lib/validations/admin.ts
  - Admin REST routes: /api/v1/admin/staff, /api/v1/admin/event-types, /api/v1/admin/years

affects: [02-04]

tech-stack:
  added: []
  patterns:
    - "assertAdmin(session) throws 403 for non-admin staff — used as first call in all admin routes"
    - "Staff deactivation: DB locked_until update + supabaseAdmin.auth.admin.signOut() for immediate session revocation"

key-files:
  created:
    - lib/auth/admin.ts
    - lib/admin/event-types.ts
    - lib/admin/years.ts
    - lib/validations/admin.ts
    - app/api/v1/admin/staff/route.ts
    - app/api/v1/admin/staff/[id]/route.ts
    - app/api/v1/admin/event-types/route.ts
    - app/api/v1/admin/event-types/[id]/route.ts
    - app/api/v1/admin/years/route.ts
    - app/api/v1/admin/years/[id]/route.ts
  modified:
    - lib/db/staff.ts
    - test/integration/admin.test.ts

key-decisions:
  - "setActiveYear uses db.update(schools) directly (schools has no RLS)"
  - "Admin routes use assertAdmin guard from lib/auth/admin.ts — never inline role check"
  - "Staff deactivation revokes Supabase auth session immediately via signOut global scope"

patterns-established:
  - "All admin routes follow: assertAdmin → parse body with Zod → call domain helper → return camelCase response"

requirements-completed:
  - ADMIN-01
  - ADMIN-02
  - ADMIN-03

duration: 20min
completed: 2026-05-12
---

# Phase 02 Plan 03: Admin REST API

**Admin CRUD REST surface for staff users, event types, and academic years. assertAdmin guard + domain helpers + integration tests.**

## What was built

- `lib/auth/admin.ts` — `assertAdmin(session)` guard
- `lib/admin/event-types.ts` — `listEventTypes`, `createEventType`, `updateEventType`, `deleteEventType`
- `lib/admin/years.ts` — `listAcademicYears`, `createAcademicYear`, `updateAcademicYear`, `setActiveYear`
- `lib/db/staff.ts` (extended) — `createStaffUser`, `updateStaffUser`, `listStaffUsers`, `deactivateStaffUser`
- `lib/validations/admin.ts` — Zod schemas for staff/event-type/year CRUD operations
- 6 route files under `app/api/v1/admin/`

## Self-Check: PASSED
