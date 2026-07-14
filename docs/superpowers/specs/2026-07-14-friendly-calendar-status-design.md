# Friendly calendar status design

## Goal

Make calendar experiences friendlier and easier to scan without changing event
workflows, filtering behavior for ordinary events, permissions, or accessibility.

## Scope

The visual calendar surfaces are the public timeline, public weekly timeline and
mobile list, yearly calendar, agenda, and their staff dashboard counterparts.
The iCal feed is not a visual surface and is unchanged.

## Date status rules

`holiday` and `vacation` are identified by their existing event-type keys. No
schema or API contract changes are required.

- Friday and Saturday are weekends for every viewer.
- An approved, non-cancelled `holiday` marks every date it spans as a universal
  closure. Holidays remain available to date-status rendering even when a grade
  filter is active, so the closure is visible to everyone.
- An approved, non-cancelled `vacation` marks every date it spans only where
  that event is otherwise visible/relevant to the current grade-scoped view.
- A date can have both a weekend and a closure. The closure styling takes
  precedence while a semantic marker preserves the weekend meaning for
  assistive users.
- Ordinary events, including all-day events, do not block a date.

A small pure date-status helper will expose this logic to view-model builders
and UI components. Date calculations will use existing Jerusalem-aware model
dates and the inclusive date range rules already used by calendar projections.

## Presentation

The site receives a calm, professional visual refresh:

- warm, lightly tinted page canvas instead of large plain-white expanses;
- layered surfaces, subtle borders and shadows, and colored navigation/control
  accents;
- a very faint neutral weekend tint used only as a fast visual scan aid, not as
  a closure or holiday treatment;
- distinct, more prominent holiday and vacation closure treatments derived from
  their existing event-type colors, so the two are immediately distinguishable;
- existing event type color and glyph encodings remain unchanged.

The refresh maintains RTL logical CSS, keyboard focus treatment, WCAG contrast,
responsive layouts, and monochrome print output. No existing actions, filters,
event detail affordances, or data density are removed.

## Grade selection

Wizard Step 2 gets a translated, keyboard-accessible select-all toggle when two
or more grades are available. It selects or clears exactly the editor's allowed
grades and continues storing the normal explicit grade array. A scoped editor
cannot select grades outside their scope.

## Testing and verification

Unit tests will cover date statuses, holiday filter behavior, vacation grade
relevance, weekend detection, and grade select-all. Existing component and view
tests will be updated for visual semantics where appropriate. Full verification
will run focused tests, lint, strict type-checking, production build, and the
relevant Playwright accessibility/interaction tests.

## Non-goals

This work does not alter event schemas, event state transitions, database access,
RLS policies, user roles, permissions, or iCal content.
