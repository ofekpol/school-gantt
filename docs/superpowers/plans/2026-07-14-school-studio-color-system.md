# School Studio Color System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a bright, accessible School Studio visual system throughout public, staff, and admin experiences.

**Architecture:** Extend the existing `--sg-*` variables into semantic palette and component tokens, then migrate shared shell and high-traffic components to those tokens. Event type and calendar-availability colors remain independent semantic systems.

**Tech Stack:** Next.js 15, React 19, TypeScript 5 strict, Tailwind CSS 4, Vitest, Playwright.

## Global Constraints

- Preserve all event, holiday, vacation, canceled, success, and error colors.
- Keep WCAG 2.1 AA contrast, keyboard focus, RTL logical properties, responsive behavior, and print output.
- Do not alter data, APIs, auth, RLS, permissions, or workflows.
- Use `--sg-*` semantic tokens; do not scatter palette hex literals in components.

---

### Task 1: Establish the School Studio token system

**Files:** Modify `app/globals.css`; test `test/unit/smoke.test.ts`.

- [ ] **Step 1: Write a failing token-contract test**

```ts
it("defines the School Studio accent tokens", () => {
  const css = readFileSync("app/globals.css", "utf8");
  expect(css).toContain("--sg-studio-blue");
  expect(css).toContain("--sg-studio-violet");
  expect(css).toContain("--sg-studio-mint");
});
```

- [ ] **Step 2: Verify red** — run `pnpm test -- test/unit/smoke.test.ts`; expect missing-token assertions.

- [ ] **Step 3: Implement the token layer**

```css
:root {
  --sg-studio-blue: #2563eb;
  --sg-studio-violet: #8b5cf6;
  --sg-studio-mint: #34d399;
  --sg-studio-sun: #fbbf24;
  --sg-studio-coral: #fb7185;
  --sg-page: #f4f8ff;
}
```

Add shared `.sg-ribbon`, `.sg-card`, `.sg-button-primary`, and `.sg-button-violet` classes with hover/focus-visible states; apply `prefers-reduced-motion` to any ribbon animation.

- [ ] **Step 4: Verify green and commit** — rerun the focused test, then `git add app/globals.css test/unit/smoke.test.ts && git commit -m "style: add school studio design tokens"`.

### Task 2: Color shared navigation and public viewer chrome

**Files:** Modify `app/layout.tsx`, `components/AppHeader.tsx`, `components/PublicViewerShell.tsx`, `components/FilterBar.tsx`, `components/RouteProgress.tsx`; test `test/unit/views/public-viewer-shell.test.tsx`.

- [ ] **Step 1: Write a failing shell test**

```tsx
it("uses the studio ribbon on public viewer navigation", () => {
  renderPublicViewer("gantt");
  expect(document.querySelector(".sg-ribbon")).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify red** — run `pnpm test -- test/unit/views/public-viewer-shell.test.tsx`; expect no ribbon.

- [ ] **Step 3: Implement shared chrome styling**

Use the ribbon in app headers and public tabs; use blue for selected view, violet for filter/zoom active states, and sky/mint tinted cards without changing labels, ARIA roles, or click targets.

- [ ] **Step 4: Verify green and commit** — rerun the focused test, then `git add app/layout.tsx components/AppHeader.tsx components/PublicViewerShell.tsx components/FilterBar.tsx components/RouteProgress.tsx test/unit/views/public-viewer-shell.test.tsx && git commit -m "style: brighten shared navigation"`.

### Task 3: Color staff workflows and dashboard controls

**Files:** Modify `components/dashboard/DashboardCalendar.tsx`, `components/dashboard/QuickEventDialog.tsx`, `components/wizard/WizardShell.tsx`, `components/wizard/Step1Date.tsx` through `Step7Summary.tsx`; test `test/unit/dashboard/dashboard-calendar.test.tsx` and `test/unit/dashboard/quick-event-dialog.test.tsx`.

- [ ] **Step 1: Write failing controls test**

```tsx
it("marks the quick publish control as the studio primary action", () => {
  renderQuickEventDialog();
  expect(screen.getByRole("button", { name: "submit" })).toHaveClass("sg-button-primary");
});
```

- [ ] **Step 2: Verify red** — run `pnpm test -- test/unit/dashboard/quick-event-dialog.test.tsx`; expect the class assertion to fail.

- [ ] **Step 3: Implement staff color hierarchy**

Use violet for wizard progress and next-step actions, blue for publishing, mint for positive staff controls, and sunshine for supportive empty-state prompts. Preserve current error/destructive visuals and all event-type colors.

- [ ] **Step 4: Verify green and commit** — run both dashboard-focused test files, then `git add components/dashboard components/wizard test/unit/dashboard && git commit -m "style: color staff event workflows"`.

### Task 4: Color admin surfaces and common feedback UI

**Files:** Modify `app/(admin)/layout.tsx`, `components/admin/*.tsx`, `components/LoadingPanel.tsx`, `components/ErrorPanel.tsx`, `components/ExportToGoogleCalendarButton.tsx`; test existing admin and smoke unit suites.

- [ ] **Step 1: Write a failing admin visual-hook test**

```tsx
it("uses the mint management accent for active staff", () => {
  renderStaffTable();
  expect(screen.getByText("active")).toHaveClass("sg-status-mint");
});
```

- [ ] **Step 2: Verify red** — run `pnpm test -- test/unit/admin/staff-role-permissions.test.tsx`; expect absent class.

- [ ] **Step 3: Implement admin and feedback styles**

Apply mint management panels, violet section labels, coral notice emphasis, and sunshine empty-state prompts through semantic utility classes; retain table density, form behavior, and existing semantic status colors.

- [ ] **Step 4: Verify green and commit** — rerun the admin-focused test and `pnpm tsc --noEmit`, then `git add 'app/(admin)' components/admin components/LoadingPanel.tsx components/ErrorPanel.tsx components/ExportToGoogleCalendarButton.tsx test/unit/admin && git commit -m "style: refresh admin and feedback surfaces"`.

### Task 5: Full visual regression verification

**Files:** Modify only files above if a command reports a concrete failure.

- [ ] **Step 1: Run all tests** — `pnpm test`; expect PASS with established DB-dependent skips only.
- [ ] **Step 2: Run lint/type/build** — `pnpm lint && pnpm tsc --noEmit && pnpm build`; expect every command to exit 0.
- [ ] **Step 3: Run browser accessibility tests** — `pnpm playwright test test/e2e/a11y.spec.ts`; expect PASS or the existing `DATABASE_URL` prerequisite failure.
- [ ] **Step 4: Inspect final diff** — `git diff --check origin/main...HEAD && git status --short`; expect no whitespace errors or unexpected files.
