# Multi-day Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff create one inclusive, all-day event range through either event-creation interface.

**Architecture:** A pure formatter will build the existing `startAt` and `endAt` payload fields. The dashboard dialog and full wizard keep range-only UI state locally, force all-day mode while the `כמה ימים` control is selected, and reuse the formatter.

**Tech Stack:** Next.js, React, TypeScript, next-intl, Vitest, Testing Library.

## Global Constraints

- Do not add a database migration; preserve the existing timestamp range model.
- Add Hebrew copy first and mirror it in English.
- An all-day range runs from `00:00:00+02:00` on the start date through `23:59:59+02:00` on the end date.
- The end date must be the same as or later than the start date.

---

### Task 1: Format an event date range

**Files:**

- Create: `lib/events/date-range.ts`
- Create: `test/unit/events/date-range.test.ts`

**Interfaces:** `buildEventTimeRange({ startDate, endDate?, allDay, startTime, endTime })` returns `{ startAt, endAt }` or throws `RangeError` when the dates are inverted.

- [ ] **Step 1: Write the failing test**

```ts
expect(buildEventTimeRange({
  startDate: "2026-07-14", endDate: "2026-07-16", allDay: true,
  startTime: "08:00", endTime: "09:00",
})).toEqual({
  startAt: "2026-07-14T00:00:00+02:00",
  endAt: "2026-07-16T23:59:59+02:00",
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run test/unit/events/date-range.test.ts`

Expected: failure because the formatter module does not exist.

- [ ] **Step 3: Implement minimally**

```ts
const endDate = input.endDate ?? input.startDate;
if (endDate < input.startDate) throw new RangeError("end_date_before_start_date");
if (input.allDay) {
  return {
    startAt: `${input.startDate}T00:00:00+02:00`,
    endAt: `${endDate}T23:59:59+02:00`,
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run test/unit/events/date-range.test.ts`

Expected: all formatter tests pass.

### Task 2: Add dashboard range controls

**Files:**

- Modify: `components/dashboard/QuickEventDialog.tsx`
- Modify: `test/unit/dashboard/quick-event-dialog.test.tsx`
- Modify: `messages/he.json`
- Modify: `messages/en.json`

**Interfaces:** Add `multiDay` and `endDate` to `QuickEventData`; use `buildEventTimeRange` for both the request and the optimistic event.

- [ ] **Step 1: Write the failing UI test**

```tsx
await user.click(screen.getByRole("checkbox", { name: "multiDay" }));
expect(screen.getByLabelText("endDate")).toHaveValue("2026-07-14");
expect(screen.getByRole("checkbox", { name: "allDay" })).toBeChecked();
expect(screen.getByRole("checkbox", { name: "allDay" })).toBeDisabled();
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run test/unit/dashboard/quick-event-dialog.test.tsx`

Expected: failure because the multi-day control is absent.

- [ ] **Step 3: Implement minimally**

Render a translated `multiDay` checkbox, reveal a translated `endDate` date input, lock all-day mode while enabled, validate the inclusive date order, and submit the formatter output. Add `multiDay`, `endDate`, and `errorEndBeforeStart` to both locale files.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run test/unit/dashboard/quick-event-dialog.test.tsx`

Expected: all dialog tests pass.

### Task 3: Add wizard range controls

**Files:**

- Modify: `components/wizard/WizardShell.tsx`
- Modify: `test/unit/events/date-range.test.ts`

**Interfaces:** Add wizard-only `multiDay` / `endDate`; derive them from draft timestamps when resuming; pass the formatter result to the existing API payload.

- [ ] **Step 1: Add a failing non-all-day formatter test**

```ts
expect(buildEventTimeRange({
  startDate: "2026-07-14", allDay: false, startTime: "08:00", endTime: "09:00",
})).toEqual({
  startAt: "2026-07-14T08:00:00+02:00",
  endAt: "2026-07-14T09:00:00+02:00",
});
```

- [ ] **Step 2: Verify RED, then implement**

Run: `pnpm vitest run test/unit/events/date-range.test.ts`

Expected: the new test fails before the single-day default is implemented. Update the formatter and wizard normalization/UI so multi-day forces all-day, uses its selected end date, and displays the translated ordering error.

- [ ] **Step 3: Verify GREEN**

Run: `pnpm vitest run test/unit/events/date-range.test.ts test/unit/dashboard/quick-event-dialog.test.tsx`

Expected: all targeted tests pass.

### Task 4: Verify and integrate

**Files:** Verify only.

- [ ] **Step 1: Run quality checks**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm build`

Expected: every command exits with code 0.

- [ ] **Step 2: Commit, merge, and push**

```bash
git add -A
git commit -m "feat: support multi-day all-day events"
git checkout main
git merge feature/multi-day-events
git push origin main
```
