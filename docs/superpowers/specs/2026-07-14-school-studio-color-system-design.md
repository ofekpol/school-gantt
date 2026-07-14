# School Studio color system design

## Goal

Make the complete school calendar platform feel bright, welcoming, and easy to
navigate while preserving professional clarity, accessibility, and all existing
calendar color meanings.

## Visual language

The visual direction is **School Studio**: a clear, youthful primary palette
with soft pastel surfaces. It takes its cues from colored school folders and
highlighters rather than a generic SaaS dashboard.

| Token | Value | Use |
| --- | --- | --- |
| Sky canvas | `#F4F8FF` | Page background and low-priority panels |
| Ink | `#17324D` | Primary text and high-contrast controls |
| Royal blue | `#2563EB` | Primary actions, active navigation, focus |
| Violet | `#8B5CF6` | Event creation and wizard progress |
| Mint | `#34D399` | Staff/admin management states |
| Sunshine | `#FBBF24` | Helpful highlights and empty-state prompts |
| Coral | `#FB7185` | Important notice emphasis; never destructive status |

The signature is a narrow multicolor schedule ribbon across shared application
headers and key section controls. It is decorative only and has no semantic
meaning.

## Scope

Shared shell, public viewer, staff dashboard, wizard, admin pages, common
dialogs, filters, tables, cards, empty/loading panels, and navigation will use
the token system. Existing event-type colors—and weekend, holiday, vacation,
canceled, and success/error semantics—are unchanged.

## Accessibility and behavior

- Text, form controls, and focus rings retain WCAG 2.1 AA contrast.
- Color is always paired with existing text, icon, shape, or label cues.
- RTL uses logical properties; no layout changes may introduce `left` or
  `right` positioning.
- Hover, focus, active, disabled, responsive, keyboard, and print behavior
  remain intact.
- The calendar date-status colors remain reserved for availability semantics.

## Implementation approach

Central CSS variables will define the palette and semantic component tokens.
The shared layout and reusable components consume those tokens first; repeated
neutral/blue utility styles in major staff, admin, and public surfaces are then
replaced with the matching semantic token classes. No data model, API, auth,
permissions, or event workflow changes are required.

## Verification

Update focused component snapshots/behavior tests only where class-level
semantics are asserted. Run lint, strict type check, unit suite, production
build, and available accessibility browser tests. Browser E2E remains dependent
on a configured `DATABASE_URL`.
