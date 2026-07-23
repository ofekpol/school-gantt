# Calendar Print Mode Design

## Goal

Let staff choose either a color or black-and-white rendering for one selected calendar month before opening the browser print dialog.

## Existing flow

The Calendar view's Export button opens a choice dialog for Google Calendar or calendar printing. Choosing printing opens a dialog with a month selector and a Print action. The print action portals only that month into a print-only sheet and invokes `window.print()`.

## Interaction design

The existing flow remains intact:

1. Select Export on the Calendar view.
2. Select Print calendar.
3. Select the month to print.
4. Select Print in color or Black and white. Color is the default.
5. Select Print to open the system print dialog.

The selected mode is set on the document body immediately before printing and removed when printing completes, so the on-screen calendar never changes.

## Color mode

Color mode forces exact color adjustment for event chips and connected event segments. Each event keeps its configured event-type background color with a contrast-safe text color.

## Black-and-white mode

Black-and-white mode removes event fills and uses a black border plus a type-specific border treatment. Event glyphs remain visible. Canceled events retain their strike-through treatment. This makes separate event categories easy to scan even when a printer cannot reproduce color.

## Scope and constraints

- Reuse the existing Export → Print → month-picker flow; do not add a second print entry point.
- Use logical CSS properties and keep the layout compatible with Hebrew RTL.
- Add Hebrew source strings and matching English translations.
- The print-only portal must render a single selected month.
- Add component-level tests for selecting a mode and invoking printing with the corresponding body state.
