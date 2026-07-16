# Connected Multi-day Calendar Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every true multi-day event as a continuous, Google Calendar-style bar in shared monthly calendars.

**Architecture:** Extend the pure calendar projection with week-local event segments and collision-free lanes. The shared calendar grid renders each week’s day cells, a positioned segment layer for multi-day ranges, and the existing chip list for one-day events.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Calendar date membership uses Asia/Jerusalem-local dates.
- Keep single-day event chips and separately-created legacy events unchanged.
- Use logical CSS directionality and Tailwind `rounded-s-*`/`rounded-e-*`; do not add `left` or `right` layout styles.
- Reuse event colour, glyph, cancellation, update, click, and print semantics.
- No database or API changes are required.

---

### Task 1: Project connected range segments

**Files:**

- Modify: `lib/views/calendar.ts`
- Modify: `test/unit/views/calendar.test.ts`

**Interfaces:**

- Produces `CalendarWeek.segments: CalendarEventSegment[]` and `laneCount`.
- `CalendarEventSegment` extends the existing calendar event presentation with `startColumn`, `endColumn`, `lane`, `continuesBefore`, and `continuesAfter`.

- [ ] **Step 1: Write failing model tests**

```ts
it("projects a multi-day event as one weekly segment", () => {
  const event = mkEvent("trip", "2026-09-10T08:00:00+03:00", "2026-09-12T16:00:00+03:00");
  const week = buildCalendarModel({ year: YEAR, events: [event] }).months[0].weeks[1];
  expect(week.segments).toMatchObject([{ eventId: "trip", startColumn: 4, endColumn: 6, lane: 0 }]);
  expect(week.days.flatMap((day) => day?.events ?? [])).not.toContainEqual(expect.objectContaining({ eventId: "trip" }));
});
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `pnpm vitest run test/unit/views/calendar.test.ts`

Expected: FAIL because `segments` and `laneCount` do not exist.

- [ ] **Step 3: Write the minimal projection**

```ts
export interface CalendarEventSegment extends CalendarChip {
  startColumn: number;
  endColumn: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface CalendarWeek {
  days: (CalendarDay | null)[];
  segments: CalendarEventSegment[];
  laneCount: number;
}
```

Use `jerusalemDateKey(event.startAt)` and `jerusalemDateKey(new Date(event.endAt.getTime() - 1))` to distinguish a true multi-day event. Exclude those records from `CalendarDay.events`; derive their visible per-week intersection; then assign the lowest lane whose previous segment ends before the new segment begins.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `pnpm vitest run test/unit/views/calendar.test.ts`

Expected: PASS, including existing date distribution coverage.

- [ ] **Step 5: Commit the projection**

```bash
git add lib/views/calendar.ts test/unit/views/calendar.test.ts
git commit -m "feat: project connected calendar event ranges"
```

### Task 2: Render connected week bars

**Files:**

- Modify: `components/YearCalendarGrid.tsx`
- Modify: `test/unit/views/current-period-scroll.test.tsx`
- Modify: `app/print.css`

**Interfaces:** Consumes `CalendarWeek.segments` and `laneCount`; renders a button per segment with `data-calendar-segment`, continuation data attributes, and a `gridColumn` spanning its projected day columns.

- [ ] **Step 1: Write the failing component test**

```tsx
it("renders a multi-day segment across its projected calendar columns", () => {
  const onEventClick = vi.fn();
  render(<YearCalendarGrid months={[calendarMonthWithSegment()]} yearLabel="2026" schoolName="Demo" onEventClick={onEventClick} />);
  const bar = screen.getByRole("button", { name: "טיול" });
  expect(bar).toHaveAttribute("data-calendar-segment", "true");
  expect(bar).toHaveStyle({ gridColumn: "2 / 5" });
  fireEvent.click(bar);
  expect(onEventClick).toHaveBeenCalledWith("event-1");
});
```

- [ ] **Step 2: Run the focused component test to verify RED**

Run: `pnpm vitest run test/unit/views/current-period-scroll.test.tsx`

Expected: FAIL because the segment button is not rendered.

- [ ] **Step 3: Render each week as cells plus an event layer**

```tsx
<div className="calendar-week relative grid grid-cols-7 gap-px bg-neutral-200">
  {week.days.map(renderDay)}
  <div className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-y-0.5 px-1">
    {week.segments.map((segment) => (
      <button
        data-calendar-segment="true"
        className={cn("pointer-events-auto truncate border border-black/10 px-1 py-0.5 text-start text-[10px]", segment.continuesBefore ? "rounded-s-none" : "rounded-s-sm", segment.continuesAfter ? "rounded-e-none" : "rounded-e-sm")}
        style={{ gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`, gridRow: segment.lane + 1 }}
      />
    ))}
  </div>
</div>
```

Reserve vertical room equal to `laneCount` in each day cell before rendering one-day chips. Reuse `eventTitle`, colour rules, glyph, and click behavior. Extend the monochrome print selector to include `[data-calendar-segment]`.

- [ ] **Step 4: Run focused component tests to verify GREEN**

Run: `pnpm vitest run test/unit/views/current-period-scroll.test.tsx`

Expected: PASS with current navigation and event-click coverage preserved.

- [ ] **Step 5: Commit rendering changes**

Run: `git add components/YearCalendarGrid.tsx test/unit/views/current-period-scroll.test.tsx app/print.css && git commit -m "feat: render connected calendar event bars"`

### Task 3: Verify the feature and integrate

**Files:** Verify only.

- [ ] **Step 1: Run targeted unit tests**

Run: `pnpm vitest run test/unit/views/calendar.test.ts test/unit/views/current-period-scroll.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run project quality checks**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm build`

Expected: each command exits 0.

- [ ] **Step 3: Merge and publish only after successful verification**

Run: `git checkout main && git merge --no-ff feature/calendar-multiday-bars && git push origin main`
