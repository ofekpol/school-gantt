# Public Viewer Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce public-view initial work and background overhead while preserving event data, freshness, and authorization behavior.

**Architecture:** Move each public view's expensive rendering/model work behind a client-side lazy boundary, leaving the shell responsible for shared filters and event state. Keep the public cache tag as the sole invalidation contract, add an events-only cached loader, and perform auth bypass only before Supabase setup for endpoints that never need a session.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, Next cache, Supabase SSR middleware.

## Global Constraints

- Do not modify database schema, migrations, RLS policies, or public API response schemas.
- Keep active public pages refreshed within five seconds after publish.
- Maintain strict TypeScript and next-intl user-visible strings.
- Use `db.withSchool` for every school-scoped query.

---

### Task 1: View-specific public rendering

**Files:**
- Create: `components/public/PublicGanttView.tsx`
- Create: `components/public/PublicCalendarView.tsx`
- Modify: `components/PublicViewerShell.tsx`
- Test: `test/unit/views/public-viewer-shell.test.tsx`

- [ ] Write failing tests proving inactive calendar rendering is not mounted and active views retain their event data.
- [ ] Run the focused test and confirm it fails before the lazy boundaries exist.
- [ ] Create the view components, dynamically load inactive view chunks, and prefetch them during idle time.
- [ ] Run the focused test and confirm it passes.

### Task 2: On-demand print calendar projection

**Files:**
- Modify: `components/ExportToGoogleCalendarButton.tsx`
- Modify: `components/PublicViewerShell.tsx`
- Test: `test/unit/export-google-calendar-button.test.tsx`

- [ ] Write a failing test showing the print calendar projection is requested only after selecting Print.
- [ ] Run the focused test and confirm it fails.
- [ ] Dynamically load and build the existing calendar model when print is selected, preserving the current dialog and print output.
- [ ] Run the focused test and confirm it passes.

### Task 3: Hidden-tab polling and focused API loader

**Files:**
- Modify: `lib/views/public-viewer.ts`
- Modify: `components/PublicViewerShell.tsx`
- Modify: `lib/views/public-viewer-data.ts`
- Test: `test/unit/views/public-viewer.test.ts`
- Test: `test/unit/views/public-viewer-data.test.ts`

- [ ] Write failing tests for visible-document polling eligibility and events-only payload loading.
- [ ] Run focused tests and confirm the new assertions fail.
- [ ] Implement the pure polling eligibility helper and a tagged events-only cached loader; use both from the public shell and API route.
- [ ] Run focused tests and confirm they pass.

### Task 4: Session-free public endpoint middleware path

**Files:**
- Create: `lib/auth/public-request.ts`
- Modify: `middleware.ts`
- Test: `test/unit/auth/public-request.test.ts`

- [ ] Write failing unit tests identifying only public events/signature and iCal routes as session-refresh-free.
- [ ] Run the focused test and confirm it fails.
- [ ] Add the pure route predicate and return before constructing a Supabase client for those paths.
- [ ] Run the focused test and confirm it passes.

### Task 5: Full regression verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-23-public-view-performance-design.md` only if verification exposes a requirement mismatch.

- [ ] Run the complete unit suite, TypeScript check, and direct production build.
- [ ] Inspect the production build route sizes and verify no source or database changes are outside scope.
- [ ] Commit the completed implementation atomically on `feature/public-view-performance`.
