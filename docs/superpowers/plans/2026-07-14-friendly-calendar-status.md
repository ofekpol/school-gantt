# Friendly Calendar Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every visual calendar easy to scan with friendly weekend, holiday, and grade-relevant vacation styling, while adding select-all grades to the event wizard.

**Architecture:** A pure date-status module classifies Jerusalem dates from visible events. Calendar and Gantt models expose status metadata to React renderers; public grade filtering keeps holidays universal. Shared CSS tokens provide a warmer professional surface treatment without changing existing event chips, bars, actions, APIs, or permissions.

**Tech Stack:** Next.js 15, React 19, TypeScript 5 strict, Tailwind CSS 4, next-intl, Vitest, Playwright.

## Global Constraints

- Use logical CSS only; do not add `left` or `right` layout positioning.
- Friday/Saturday use a faint scan-aid tint. `holiday` is universal; `vacation` is visible only to relevant grades.
- Ignore cancelled closures. Do not change schemas, API contracts, RLS, roles, state transitions, or iCal output.
- Keep color-plus-glyph event encoding, 44 px controls, keyboard focus, RTL support, and monochrome print readability.
- Add Hebrew messages first and mirror every new key in English; do not hardcode JSX copy.

---

## File map

| File | Responsibility |
| --- | --- |
| `lib/views/date-status.ts` | Pure date classification and closure-range helper. |
| `lib/views/calendar.ts` | Calendar-day status and closure color. |
| `lib/views/gantt.ts` | Year Gantt background ranges. |
| `lib/views/gantt-weekly.ts` | Weekly global and grade-cell statuses. |
| `lib/views/public-viewer.ts` | Grade filtering that retains universal holidays. |
| `components/YearCalendarGrid.tsx`, `components/Gantt/*.tsx`, `components/AgendaList.tsx` | Accessible visual status rendering. |
| `components/PublicViewerShell.tsx`, `components/dashboard/DashboardCalendar.tsx` | Pass status-aware visible events through public/staff views. |
| `components/wizard/Step2Grades.tsx` | Scoped select-all / clear-all control. |
| `app/globals.css`, `app/print.css` | Friendly color tokens and print fallbacks. |
| `messages/he.json`, `messages/en.json` | New translated labels. |

### Task 1: Date-status domain utility

**Files:** Create `lib/views/date-status.ts`; create `test/unit/views/date-status.test.ts`.

**Produces:** `CalendarDateStatus = "normal" | "weekend" | "holiday" | "vacation"`; `getCalendarDateStatus(date, events)`; `eventTouchesJerusalemDate(event, isoDate)`.

- [ ] **Step 1: Write a failing unit test**

```ts
it("gives an approved holiday precedence over vacation and weekend", () => {
  const events = [event("holiday", "2026-09-04", "2026-09-06"), event("vacation", "2026-09-04", "2026-09-06")];
  expect(getCalendarDateStatus(new Date("2026-09-04T12:00:00Z"), events)).toBe("holiday");
});

it("uses weekend only when no closure applies and ignores cancelled closures", () => {
  expect(getCalendarDateStatus(new Date("2026-09-04T12:00:00Z"), [])).toBe("weekend");
  expect(getCalendarDateStatus(new Date("2026-09-06T12:00:00Z"), [event("holiday", "2026-09-06", "2026-09-07", true)])).toBe("normal");
});
```

- [ ] **Step 2: Verify red** — run `pnpm vitest run test/unit/views/date-status.test.ts`; expect a module-not-found failure for `@/lib/views/date-status`.

- [ ] **Step 3: Write minimal production code**

```ts
export type CalendarDateStatus = "normal" | "weekend" | "holiday" | "vacation";

export function getCalendarDateStatus(date: Date, events: CalendarStatusEvent[]): CalendarDateStatus {
  const dateKey = jerusalemDateKey(date);
  const closures = events.filter((event) => !isCanceled(event) && eventTouchesJerusalemDate(event, dateKey));
  if (closures.some((event) => event.eventTypeKey === "holiday")) return "holiday";
  if (closures.some((event) => event.eventTypeKey === "vacation")) return "vacation";
  return isJerusalemWeekend(date) ? "weekend" : "normal";
}
```

Use `Intl.DateTimeFormat` parts for Jerusalem dates/weekdays and an exclusive `endAt` boundary.

- [ ] **Step 4: Verify green** — run `pnpm vitest run test/unit/views/date-status.test.ts`; expect PASS.

- [ ] **Step 5: Commit** — run `git add lib/views/date-status.ts test/unit/views/date-status.test.ts && git commit -m "feat: add calendar date status utility"`.

### Task 2: Preserve holidays through public grade filters

**Files:** Modify `lib/views/public-viewer.ts:43-58`; modify `test/unit/views/public-viewer.test.ts:51-71`.

**Produces:** `filterPublicEvents` treats `holiday` as grade-universal but continues applying event-type and text filters.

- [ ] **Step 1: Write a failing test**

```ts
it("keeps holidays visible when a selected grade is not on the event", () => {
  const filtered = filterPublicEvents(
    [{ ...baseEvent, id: "holiday", eventTypeKey: "holiday", grades: [7] }],
    { grades: [12], types: [], q: "", zoom: "year", week: null },
  );
  expect(filtered.map((event) => event.id)).toEqual(["holiday"]);
});
```

- [ ] **Step 2: Verify red** — run `pnpm vitest run test/unit/views/public-viewer.test.ts`; expect the grade predicate to exclude the holiday.

- [ ] **Step 3: Write minimal production code**

```ts
const bypassesGradeFilter = event.eventTypeKey === "holiday";
if (gradeSet.size > 0 && !bypassesGradeFilter && !event.grades.some((grade) => gradeSet.has(grade))) {
  return false;
}
```

- [ ] **Step 4: Verify green and commit** — run `pnpm vitest run test/unit/views/public-viewer.test.ts`, then `git add lib/views/public-viewer.ts test/unit/views/public-viewer.test.ts && git commit -m "feat: retain holidays in grade-filtered public views"`.

### Task 3: Extend schedule models with status metadata

**Files:** Modify `lib/views/calendar.ts`, `lib/views/gantt.ts`, `lib/views/gantt-weekly.ts`; modify `test/unit/views/calendar.test.ts`, `test/unit/views/gantt.test.ts`, `test/unit/views/gantt-weekly.test.ts`.

**Produces:** `CalendarDay.dateStatus` and `closureColor?`; `GanttModel.backgroundRanges` with `{ leftPct, widthPct, rowStart, rowSpan, status, color? }`; `WeeklyDay.dateStatus` and `WeeklyGradeRow.dayStatuses`/`closureColors`.

- [ ] **Step 1: Write failing view-model tests**

```ts
it("puts the holiday type color on its calendar day", () => {
  const day = findDay(buildCalendarModel({ year: YEAR, events: [mkClosure("holiday", [7], "holiday", "#64748b")] }), "2026-09-15");
  expect(day).toMatchObject({ dateStatus: "holiday", closureColor: "#64748b" });
});

it("limits a vacation yearly background to its assigned grade row", () => {
  const model = buildGanttModel({ year: YEAR, grades: [7, 8], events: [ganttClosure("vacation", [7], "vacation")] });
  expect(model.backgroundRanges.find((range) => range.status === "vacation")).toMatchObject({ rowStart: 0, rowSpan: 1 });
});
```

- [ ] **Step 2: Verify red** — run `pnpm vitest run test/unit/views/calendar.test.ts test/unit/views/gantt.test.ts test/unit/views/gantt-weekly.test.ts`; expect missing status properties.

- [ ] **Step 3: Write minimal production code**

Calendar cells classify all visible events. Year Gantt emits faint weekend ranges over all rows, holidays over all rows, and vacations only over contiguous relevant-grade rows. Weekly Gantt resolves global days from all events and row cells from that row's events; holiday wins in both cases.

- [ ] **Step 4: Verify green and commit** — run the same focused Vitest command; expect PASS, then run `git add lib/views/calendar.ts lib/views/gantt.ts lib/views/gantt-weekly.ts test/unit/views/calendar.test.ts test/unit/views/gantt.test.ts test/unit/views/gantt-weekly.test.ts && git commit -m "feat: expose closure status in calendar models"`.

### Task 4: Render friendly status backgrounds across public and staff views

**Files:** Modify `components/YearCalendarGrid.tsx`, `components/Gantt/GanttCanvas.tsx`, `components/Gantt/GanttWeekly.tsx`, `components/Gantt/GanttWeeklyMobileList.tsx`, `components/AgendaList.tsx`, `components/PublicViewerShell.tsx`, `components/dashboard/DashboardCalendar.tsx`; modify `test/unit/views/public-viewer-shell.test.tsx` and `test/unit/dashboard/dashboard-calendar.test.tsx`.

**Produces:** `data-date-status` on day/cell/date-group containers. Holiday/vacation containers receive `--closure-color`. Gantt background layers use `pointerEvents: "none"` and remain under bars and day buttons.

- [ ] **Step 1: Write failing component tests**

```tsx
it("renders a holiday status after selecting a different public grade", () => {
  renderPublicViewerWithEvents([{ ...event, eventTypeKey: "holiday", grades: [7] }], { grades: [12] });
  expect(screen.getByTestId("calendar-status-holiday")).toBeInTheDocument();
});

it("renders the selected grade's vacation in dashboard monthly view", () => {
  renderDashboardMonthlyWithVacationForGrade(7);
  expect(screen.getByTestId("calendar-status-vacation")).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify red** — run `pnpm vitest run test/unit/views/public-viewer-shell.test.tsx test/unit/dashboard/dashboard-calendar.test.tsx`; expect absent status hooks.

- [ ] **Step 3: Write minimal production code**

Render status metadata in monthly cells, yearly and weekly Gantt backgrounds, and mobile day cards. Group agenda items by Jerusalem date so the complete date group receives its status while retaining every existing expandable event row and Google Calendar link. Feed existing grade-filtered events through staff models and visible public events through public models.

- [ ] **Step 4: Verify green and commit** — rerun the focused component command; expect PASS, then run `git add components/YearCalendarGrid.tsx components/Gantt/GanttCanvas.tsx components/Gantt/GanttWeekly.tsx components/Gantt/GanttWeeklyMobileList.tsx components/AgendaList.tsx components/PublicViewerShell.tsx components/dashboard/DashboardCalendar.tsx test/unit/views/public-viewer-shell.test.tsx test/unit/dashboard/dashboard-calendar.test.tsx && git commit -m "feat: show calendar status across viewer surfaces"`.

### Task 5: Add the professional, friendly visual system

**Files:** Modify `app/globals.css`, `app/print.css`, `components/PublicViewerShell.tsx`, `components/FilterBar.tsx`, `components/dashboard/DashboardCalendar.tsx`.

**Produces:** warm page and raised-surface tokens, faint weekend styling, event-color-driven closure styling, and monochrome status outlines.

- [ ] **Step 1: Add CSS tokens and status selectors**

```css
:root {
  --sg-page: oklch(0.975 0.014 85);
  --sg-surface-raised: oklch(1 0.006 85);
  --sg-weekend-bg: oklch(0.965 0.012 270);
}

[data-date-status="weekend"] { background: var(--sg-weekend-bg); }
[data-date-status="holiday"], [data-date-status="vacation"] {
  background: color-mix(in oklch, var(--closure-color) 16%, var(--sg-surface));
  box-shadow: inset 0 3px 0 var(--closure-color);
}
```

- [ ] **Step 2: Apply the visual system** — change only shared page/chrome/schedule surfaces from plain-white/neutral utilities to token-backed warm canvas, raised cards, subtle borders, and restrained accents; do not alter event chip/bar colors or density.

- [ ] **Step 3: Add print fallback**

```css
@media print and (monochrome), print and (max-monochrome: 0) {
  [data-date-status="weekend"] { background: #fff !important; }
  [data-date-status="holiday"], [data-date-status="vacation"] { background: #fff !important; outline: 1px solid #000; }
}
```

- [ ] **Step 4: Commit** — run `git add app/globals.css app/print.css components/PublicViewerShell.tsx components/FilterBar.tsx components/dashboard/DashboardCalendar.tsx && git commit -m "style: refresh calendar surfaces"`.

### Task 6: Add Wizard Step 2 select-all

**Files:** Modify `components/wizard/Step2Grades.tsx`; modify `messages/he.json` and `messages/en.json`; create `test/unit/wizard/step2-grades.test.tsx`.

**Produces:** select-all / clear-all control only when two or more grades are allowed, with an explicit, scoped grade array payload.

- [ ] **Step 1: Write failing tests**

```tsx
it("submits exactly every allowed grade after select all", async () => {
  const user = userEvent.setup();
  renderStep({ allowedGrades: [7, 9, 11] });
  await user.click(screen.getByRole("button", { name: "selectAll" }));
  await user.click(screen.getByRole("button", { name: "next" }));
  expect(onNext).toHaveBeenCalledWith({ grades: [7, 9, 11] });
});
```

- [ ] **Step 2: Verify red** — run `pnpm vitest run test/unit/wizard/step2-grades.test.tsx`; expect control absence.

- [ ] **Step 3: Write minimal production code**

```tsx
const gradeOptions = Array.from(new Set(allowedGrades)).sort((a, b) => a - b);
const allSelected = gradeOptions.length > 0 && gradeOptions.every((grade) => grades.includes(grade));
```

Render an `aria-pressed` button that sets `[]` when `allSelected`, otherwise `gradeOptions`; retain individual pills and required-grade validation.

- [ ] **Step 4: Add translation keys, verify green, and commit** — add `wizard.step2.selectAll` and `wizard.step2.clearAll` in both locales; run `pnpm vitest run test/unit/wizard/step2-grades.test.tsx`; expect PASS; then run `git add components/wizard/Step2Grades.tsx messages/he.json messages/en.json test/unit/wizard/step2-grades.test.tsx && git commit -m "feat: add wizard grade select all"`.

### Task 7: Run full verification

**Files:** Modify only the files above if a verification command reports a concrete failure.

- [ ] **Step 1: Run tests** — `pnpm test`; expect PASS, or existing DB-specific environment guards to skip.
- [ ] **Step 2: Run static and production checks** — `pnpm lint && pnpm tsc --noEmit && pnpm build`; expect all exit 0.
- [ ] **Step 3: Run browser checks** — `pnpm playwright test test/e2e/a11y.spec.ts test/e2e/smoke.spec.ts`; expect PASS or documented DB environment skips.
- [ ] **Step 4: Inspect final branch** — `git status --short && git diff --check origin/main...HEAD && git log --oneline origin/main..HEAD`; expect no whitespace errors and only intentional commits.
