# Connected multi-day calendar bars

## Goal

Show a single multi-day event as a continuous, Google Calendar-style bar in
the monthly calendar. The treatment is shared by the staff dashboard and the
public calendar, which both render `YearCalendarGrid`.

## Scope

- A single event whose stored time range covers multiple Jerusalem calendar
  dates is displayed as a connected bar.
- Within one calendar week, the bar spans every covered day cell.
- Bars that continue into or out of a week have square inner edges; the true
  start and end use rounded outer edges.
- An event that crosses a calendar-week boundary continues as a segment in the
  next week at the same visual lane when possible.
- Single-day events retain the current chip treatment.
- Existing events that were separately created for each day remain separate.
  The calendar must not infer relationships from equal titles or event types.

## Architecture

`lib/views/calendar.ts` remains the pure calendar projection. It will derive
per-week event segments from each event range and expose their start/end day
columns, continuation flags, and collision-free lane index alongside the
existing day cells.

`YearCalendarGrid` will render each week as a seven-column day grid plus a
positioned event layer. A multi-day segment is placed in its projected lane and
spans its covered columns. The existing click callback remains attached to each
segment. Day cells continue to render single-day chips and the date controls.

## Rendering and accessibility

- Segment colours, glyphs, cancellation, and updated-state labels reuse the
  existing event-chip semantics and monochrome print styles.
- Connected bars use logical CSS positioning and direction-safe grid columns;
  no `left` or `right` layout properties are introduced.
- The bar uses an accessible button with the same event title and click action
  as current chips. It remains keyboard focusable when event navigation is
  enabled.
- Weekly row height reserves space for the highest populated event lane, so
  bars never overlap the date control or each other.

## Error handling

Malformed or zero-length events retain the current date bucketing behavior and
are not rendered as a connected range. Calendar rendering remains resilient to
events outside the visible display range.

## Testing

- Add model tests for a within-week range, a range that crosses weeks, lane
  collision avoidance, and a single-day event remaining a chip.
- Add component tests verifying the rendered multi-day segment spans the
  expected columns and invokes the existing event-click handler.
- Run the targeted unit tests, lint, type check, and production build.
