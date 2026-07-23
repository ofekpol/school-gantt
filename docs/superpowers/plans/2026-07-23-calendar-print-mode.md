# Calendar Print Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow staff to select color or black-and-white rendering when printing one chosen calendar month through the existing Export flow.

**Architecture:** Restore the deployed Export choice and print-dialog flow. The print dialog owns a `PrintMode` selection and passes it to the export component, which temporarily sets a body data attribute before portalling the selected month and calling `window.print()`. Print CSS scopes color preservation and monochrome presentation to that attribute.

**Tech Stack:** Next.js 15, React 19, TypeScript, next-intl, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Strict TypeScript; no `any`.
- Use `next-intl` for every user-facing string; add Hebrew first and mirror it in English.
- Use logical CSS properties only.
- Keep the browser-visible calendar unmodified by print-mode selection.
- Print exactly one selected calendar month.

---

## File structure

- `components/ExportToGoogleCalendarButton.tsx` — Export choice dialog, print month/mode dialog, print portal, temporary body state.
- `components/YearCalendarGrid.tsx` — Print-safe data attributes for type-specific monochrome rendering.
- `app/print.css` — Color and black-and-white print-mode rules.
- `components/dashboard/DashboardCalendar.tsx` and `components/PublicViewerShell.tsx` — Supply calendar print options to the Export component.
- `messages/he.json` and `messages/en.json` — Print-mode copy.
- `test/unit/export-google-calendar-button.test.tsx` — Export choices, print-mode selection, and print side effects.

### Task 1: Cover the print dialog’s mode selection

**Files:**
- Modify: `test/unit/export-google-calendar-button.test.tsx`

**Interfaces:**
- Consumes: `ExportToGoogleCalendarButton` with `printCalendar: { months, schoolName, yearLabel, defaultMonthIndex? }`.
- Produces: a regression test showing that `data-print-mode` is present before `window.print()`.

- [ ] Write a failing test that opens Export, chooses Print calendar, selects Black and white, and asserts `document.body.dataset.printMode === "monochrome"` when `window.print()` runs.
- [ ] Run `pnpm vitest run test/unit/export-google-calendar-button.test.tsx` and confirm that it fails because the current component has no print choice or mode radio controls.
- [ ] Restore the choice dialog, `PrintDialog`, selected-month print portal, and `type PrintMode = "color" | "monochrome"`. The dialog must default to `color` and call `onPrint(monthIndex, mode)`.
- [ ] In the print handler, use `flushSync` to set the selected month, set `document.body.dataset.printMode = mode`, remove it on `afterprint`, and then call `window.print()`.
- [ ] Run `pnpm vitest run test/unit/export-google-calendar-button.test.tsx` and confirm it passes.

### Task 2: Make printed event types distinguishable

**Files:**
- Modify: `components/YearCalendarGrid.tsx`
- Modify: `app/print.css`

**Interfaces:**
- Consumes: `data-print-mode` and each chip/segment’s `eventTypeKey`.
- Produces: color-preserving styles for color mode and type-distinct black-and-white styling for monochrome mode.

- [ ] Extend the test to assert the rendered calendar event button has `data-event-type="trip"`.
- [ ] Run `pnpm vitest run test/unit/export-google-calendar-button.test.tsx` and confirm the data-attribute assertion fails.
- [ ] Add `data-event-type={chip.eventTypeKey}` to single-day chips and `data-event-type={segment.eventTypeKey}` to connected segments.
- [ ] Scope `-webkit-print-color-adjust: exact` and `print-color-adjust: exact` to `body[data-print-mode="color"] .print-calendar-sheet` event chips and segments.
- [ ] In `body[data-print-mode="monochrome"]`, force white fills and black text/borders, preserve cancellation strike-through, and assign a distinct `border-style`/`border-width` combination to every event type.
- [ ] Run `pnpm vitest run test/unit/export-google-calendar-button.test.tsx` and confirm it passes.

### Task 3: Wire the existing Calendar surfaces and labels

**Files:**
- Modify: `components/dashboard/DashboardCalendar.tsx`
- Modify: `components/PublicViewerShell.tsx`
- Modify: `messages/he.json`
- Modify: `messages/en.json`

**Interfaces:**
- Consumes: `CalendarMonth[]`, school name, academic-year label, and the active month index.
- Produces: `printCalendar` props and translated print-mode labels.

- [ ] Add failing component assertions for the Export choices and `Print in color`/`Black and white` labels.
- [ ] Run `pnpm vitest run test/unit/export-google-calendar-button.test.tsx` and confirm the labels are absent.
- [ ] Pass `printCalendar={{ months, schoolName, yearLabel, defaultMonthIndex }}` from dashboard and public Calendar callers.
- [ ] Add `exportTitle`, `googleCalendar`, `printCalendar`, `printTitle`, `chooseMonthToPrint`, `printMode`, `color`, `blackAndWhite`, and `print` in `messages/he.json`, then add exact English counterparts to `messages/en.json`.
- [ ] Run `pnpm vitest run test/unit/export-google-calendar-button.test.tsx && pnpm tsc --noEmit` and confirm both commands pass.

### Task 4: Verify real PDF output

**Files:**
- Verify: `app/print.css`

- [ ] Run `pnpm build` and confirm it passes.
- [ ] In the Calendar Export flow, save one color and one black-and-white PDF for the same month.
- [ ] Render each saved PDF with `pdftoppm -png -r 144 <pdf> tmp/pdfs/calendar-print` and inspect it: color mode has distinct event-type fills, monochrome mode has distinct borders/glyphs and readable text.
- [ ] Commit the implementation with `git commit -m "feat: add calendar print color modes"`.
