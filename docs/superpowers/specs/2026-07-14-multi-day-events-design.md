# Multi-day all-day events

## Goal

Let staff create one all-day event that appears on every day in an inclusive date range, without duplicating the event.

## Scope

- Add a Hebrew `כמה ימים` control to the dashboard quick-event dialog.
- Add the same control to the full event wizard's time step.
- When enabled, force the event to all-day and show an end-date input.
- Persist one event whose `start_at` is the selected start date at `00:00:00` and whose `end_at` is the selected end date at `23:59:59`, both in the existing Jerusalem-offset representation.
- Require the end date to be on or after the start date.
- Keep ordinary one-day and timed-event behavior unchanged.

## Data and view behavior

The existing `events.start_at` and `events.end_at` columns represent the complete range, so no schema migration or duplicate event rows are required. Public calendar, Gantt, agenda, and iCal projections consume those timestamps and will receive the same one-record range.

## Error handling and tests

- The form shows a translated validation message for an end date before the start date.
- Unit tests cover date-range construction and the invalid range case for both creation flows.
- Existing view tests remain the regression coverage for rendering a multi-day timestamp span.
