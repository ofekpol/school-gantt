# Calendar-led visual system design

## Goal

Replace the detached rainbow decoration with a cohesive, more engaging interface
whose visual energy comes from the school calendar and meaningful controls.

## Visual direction

- Remove the multicolor header ribbon everywhere.
- Royal blue remains the consistent navigation and primary-action color.
- Violet identifies view toggles, workflow progress, and calendar navigation.
- The weekly calendar becomes the visual center: softly colored weekday headers,
  rounded grade lanes, a more prominent today marker, and elevated controls.
- Weekend, holiday, vacation, event-type, canceled, and error colors retain
  their current semantic meanings and remain separate from decorative accents.

## Consistent surfaces

Shared `--sg-*` tokens define page canvas, card, filter panel, table header,
role badge, and status badge surfaces. The dashboard, public viewer, and staff
management page consume the same components and color hierarchy.

Staff management gains tinted summary cards, a blue-violet filter panel,
purposeful role/status badges, and subtly differentiated interactive table rows.
The result is more welcoming without reducing table density or operational
clarity.

## Behavior and accessibility

No event, staff, filtering, auth, permission, or calendar behavior changes.
All existing controls preserve keyboard operation, focus visibility, RTL layout,
responsive behavior, contrast, print handling, and non-color labels.

## Verification

Add focused component tests for the removal of the ribbon and the calendar/staff
visual hooks. Run unit tests, lint, strict type-check, build, and available
browser accessibility checks; browser E2E needs `DATABASE_URL`.
