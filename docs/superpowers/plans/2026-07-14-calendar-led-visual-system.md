# Calendar-led Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rainbow ribbon with consistent, calendar-led surfaces and elegant motion across the product.

**Architecture:** Extend the shared token system with calendar, staff-table, and motion tokens. Apply them to the Gantt, staff management, shared navigation, and loading UI while preserving all semantic event/status colors.

**Tech Stack:** Next.js 15, React 19, TypeScript 5 strict, Tailwind CSS 4, Vitest, Playwright.

## Global Constraints

- Remove `.sg-ribbon` usage and preserve blue/violet as navigation/workflow anchors.
- Preserve event, weekend, holiday, vacation, canceled, success, and error meanings.
- All motion respects `prefers-reduced-motion: reduce`; preserve RTL, AA contrast, and keyboard behavior.
- Do not alter API, permission, data, or event workflow behavior.

---

### Task 1: Replace ribbon tokens with calendar-led surface and motion tokens

**Files:** Modify `app/globals.css`, `components/AppHeader.tsx`, `components/PublicViewerShell.tsx`; modify `test/unit/smoke.test.ts`.

- [ ] **Step 1: Write failing assertions**

```ts
expect(css).toContain("--sg-calendar-header");
expect(css).toContain("@media (prefers-reduced-motion: reduce)");
expect(css).not.toContain(".sg-ribbon");
```

- [ ] **Step 2: Verify red** — `pnpm test -- test/unit/smoke.test.ts`; expect missing calendar token and ribbon assertion failure.
- [ ] **Step 3: Implement token layer** — add `--sg-calendar-header`, `--sg-staff-panel`, `--sg-table-hover`, `--sg-motion-fast`, and `.sg-interactive`; remove all ribbon elements/classes; use transform/color transitions only under the reduced-motion guard.
- [ ] **Step 4: Verify green and commit** — `pnpm test -- test/unit/smoke.test.ts && git add app/globals.css components/AppHeader.tsx components/PublicViewerShell.tsx test/unit/smoke.test.ts && git commit -m "style: replace ribbon with calendar-led tokens"`.

### Task 2: Make weekly calendar the visual center

**Files:** Modify `components/Gantt/GanttWeekly.tsx`, `components/Gantt/GanttWeeklyMobileList.tsx`, `components/dashboard/DashboardCalendar.tsx`; modify `test/unit/dashboard/gantt-weekly-export.test.tsx`.

- [ ] **Step 1: Write failing calendar hook test**

```tsx
expect(screen.getByLabelText("weekly rows").parentElement).toHaveClass("sg-calendar-frame");
```

- [ ] **Step 2: Verify red** — `pnpm test -- test/unit/dashboard/gantt-weekly-export.test.tsx`; expect absent calendar frame.
- [ ] **Step 3: Implement calendar styling** — add a violet-tinted weekly navigation surface, colored weekday headers, rounded grade lanes, a stronger blue today marker, and `sg-interactive` day/button states; retain date-status colors and all grid/event positioning.
- [ ] **Step 4: Verify green and commit** — rerun focused test, `pnpm tsc --noEmit`, then commit `feat: refresh weekly calendar presentation`.

### Task 3: Make staff management match the calendar system

**Files:** Modify `components/admin/StaffTable.tsx`, `components/admin/StaffMobileList.tsx`, `app/(admin)/admin/staff/page.tsx`; modify `test/unit/admin/staff-role-permissions.test.tsx`.

- [ ] **Step 1: Write failing visual hook test**

```tsx
expect(screen.getByRole("table").closest(".sg-staff-card")).not.toBeNull();
```

- [ ] **Step 2: Verify red** — `pnpm test -- test/unit/admin/staff-role-permissions.test.tsx`; expect absent staff card.
- [ ] **Step 3: Implement staff consistency** — use blue-violet filter panel, tinted metric cards, mint active-state badges, violet role badges, and soft interactive table rows; preserve text labels and table density.
- [ ] **Step 4: Verify green and commit** — rerun focused test and commit `style: align staff management with calendar system`.

### Task 4: Add elegant route and surface motion

**Files:** Modify `components/RouteProgress.tsx`, `components/LoadingPanel.tsx`, `components/FilterBar.tsx`, `components/dashboard/QuickEventDialog.tsx`; modify their existing unit tests where behavior is asserted.

- [ ] **Step 1: Write failing loading hook test**

```tsx
expect(screen.getByRole("status")).toHaveClass("sg-loading-panel");
```

- [ ] **Step 2: Verify red** — run the LoadingPanel focused test; expect missing class.
- [ ] **Step 3: Implement motion** — use 140–220 ms opacity/transform transitions, a blue-violet route-progress gradient, hover lift only for cards/buttons, and no transform animation inside the reduced-motion media query.
- [ ] **Step 4: Verify green and commit** — run relevant unit tests and commit `style: add elegant interface motion`.

### Task 5: Verify the finished visual system

- [ ] **Step 1: Run tests** — `pnpm test`; expect PASS with established DB skips.
- [ ] **Step 2: Run static/production checks** — `pnpm lint && pnpm tsc --noEmit && pnpm build`; expect exit 0.
- [ ] **Step 3: Run accessible browser coverage** — `pnpm playwright test test/e2e/a11y.spec.ts`; expect PASS or the known missing-`DATABASE_URL` prerequisite.
- [ ] **Step 4: Review final diff** — `git diff --check origin/main...HEAD && git status --short`; expect no whitespace errors.
