---
phase: 00-foundation
plan: 02
subsystem: infrastructure
tags: [vitest, playwright, shadcn, tailwind-v4, rtl, testing]
dependency_graph:
  requires: ["00-01"]
  provides: ["vitest-runner", "playwright-runner", "shadcn-components", "rtl-css-patches"]
  affects: ["all-subsequent-plans"]
tech_stack:
  added:
    - vitest@4.1.5
    - "@vitest/coverage-v8@4.1.5"
    - "@vitejs/plugin-react@6.0.1"
    - jsdom@29.1.1
    - "@testing-library/react@16.3.2"
    - "@testing-library/jest-dom"
    - "@testing-library/user-event@14.6.1"
    - vite-tsconfig-paths@6.1.1
    - "@playwright/test@1.59.1"
    - "@base-ui/react (via shadcn@4.7.0)"
    - react-day-picker@10.0.0
    - class-variance-authority
    - clsx
    - tailwind-merge
    - tw-animate-css
    - tailwindcss@4.3.0
    - "@tailwindcss/postcss"
    - lucide-react
    - date-fns
  patterns:
    - Vitest with jsdom environment + @testing-library/jest-dom + vite-tsconfig-paths
    - Playwright with chromium-only, auto-starting dev server via webServer config
    - shadcn v4 using @base-ui/react (Base UI) primitives instead of Radix
    - Tailwind CSS v4 with @import "tailwindcss" + @theme inline color tokens
    - RTL CSS overrides in globals.css using [dir="rtl"] selector (D-01)
key_files:
  created:
    - vitest.config.ts
    - vitest.setup.ts
    - test/unit/smoke.test.ts
    - test/e2e/smoke.spec.ts
    - playwright.config.ts
    - components.json
    - lib/utils.ts
    - components/ui/button.tsx
    - components/ui/popover.tsx
    - components/ui/calendar.tsx
    - components/ui/dropdown-menu.tsx
    - app/dev/rtl-showcase/page.tsx
  modified:
    - package.json
    - pnpm-lock.yaml
    - app/globals.css
    - app/layout.tsx
    - postcss.config.mjs
    - tailwind.config.ts
    - test/unit/smoke.test.ts
decisions:
  - "shadcn v4 (4.7.0) installs @base-ui/react (Base UI) instead of Radix — handles RTL natively via dir attribute"
  - "Tailwind v3 upgraded to v4 (required by shadcn v4); @tailwindcss/postcss replaces tailwindcss in postcss config"
  - "RTL CSS overrides adapted for Base UI (logical side data attributes) rather than Radix Floating UI"
  - "app/dev/rtl-showcase (not _dev/) used because Next.js App Router treats _-prefixed folders as private (unrouted)"
metrics:
  duration: "25 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 4
  tasks_total: 5
  files_created: 12
  files_modified: 7
requirements:
  - INFRA-02
  - INFRA-03
  - INFRA-05
---

# Phase 0 Plan 02: Test Infrastructure + shadcn RTL Components Summary

Wire complete test infrastructure (Vitest + Playwright smoke tests), install shadcn v4 components (Popover, Calendar, Dropdown, Button) with Tailwind v4 CSS-only RTL patches, and validate the patches in a dev showcase page.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Wire Vitest unit testing | fe20e98 | Complete |
| 2 | Wire Playwright e2e testing | 093fb29 | Complete |
| 3 | Install shadcn + RTL CSS patches | 4a5b980 | Complete |
| 4 | Build RTL showcase page | ba20c50 | Complete |
| 5 | Visual verification checkpoint | — | Awaiting human verification |

## Vitest Configuration

File: `vitest.config.ts`

- **Environment:** `jsdom` — required for React component testing
- **Setup:** `./vitest.setup.ts` imports `@testing-library/jest-dom/vitest` (jest-dom matchers)
- **Path aliases:** `vite-tsconfig-paths` plugin reads `tsconfig.json` paths (`@/*` → `./*`)
- **Test include:** `test/unit/**/*.test.{ts,tsx}`, `lib/**/*.test.{ts,tsx}`
- **Coverage provider:** `v8` — generates text + html reports

`pnpm test` exits 0 with 2 tests passing (INFRA-02 satisfied).

## Playwright Configuration

File: `playwright.config.ts`

- **Browser:** Chromium only (`{ name: "chromium", use: { ...devices["Desktop Chrome"] } }`)
- **Auto-start:** `webServer.command: "pnpm dev"` — starts dev server automatically before tests
- **URL:** `http://localhost:3000`, `reuseExistingServer: !process.env.CI`
- **Locale:** `he-IL` applied globally
- **CI mode:** `retries: 2`, `workers: 1`, `reporter: "github"`
- **Smoke spec:** Asserts `dir="rtl"`, `lang="he"`, and `שלום עולם` heading visible

`pnpm playwright` exits 0 with 1 test passing (INFRA-03 satisfied).

## shadcn v4 + Tailwind v4 Setup

**Important deviation:** shadcn@4.7.0 uses @base-ui/react (Base UI) instead of @radix-ui/react-*. This was not anticipated in the plan which expected Radix primitives.

### What changed from the plan

| Plan assumption | Reality |
|----------------|---------|
| `@radix-ui/react-popover` | `@base-ui/react/popover` |
| `@radix-ui/react-dropdown-menu` | `@base-ui/react/menu` |
| `tailwindcss-animate` plugin | `tw-animate-css` CSS import |
| Tailwind v3 config | Tailwind v4 with `@theme inline` tokens |
| `react-day-picker v9` | `react-day-picker v10` |
| `asChild` prop pattern | `render` prop pattern (Base UI) |

### Components installed

| File | Import path | Export |
|------|-------------|--------|
| `components/ui/button.tsx` | `@/components/ui/button` | `Button`, `buttonVariants` |
| `components/ui/popover.tsx` | `@/components/ui/popover` | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription` |
| `components/ui/calendar.tsx` | `@/components/ui/calendar` | `Calendar`, `CalendarDayButton` |
| `components/ui/dropdown-menu.tsx` | `@/components/ui/dropdown-menu` | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem`, and more |

## RTL CSS Overrides (D-01)

All overrides in `app/globals.css` under the `/* ---- shadcn/ui RTL patches (D-01) ---- */` block:

```css
/* Base UI Popover/Dropdown: animation direction overrides */
[dir="rtl"] [data-side="inline-end"] { animation-name: slideInFromInlineEnd; }
[dir="rtl"] [data-side="inline-start"] { animation-name: slideInFromInlineStart; }

@keyframes slideInFromInlineEnd { from { opacity: 0; transform: translateX(8px); } ... }
@keyframes slideInFromInlineStart { from { opacity: 0; transform: translateX(-8px); } ... }

/* react-day-picker (Calendar) nav button positioning */
[dir="rtl"] .rdp-nav_button_previous { left: auto; right: 0.25rem; }
[dir="rtl"] .rdp-nav_button_next { right: auto; left: 0.25rem; }

/* DropdownMenu sub-trigger chevron flip */
[dir="rtl"] [data-slot="dropdown-menu-sub-trigger"] > svg:last-child {
  transform: scaleX(-1);
}
```

**Note:** Base UI is direction-aware by design. The Popover and DropdownMenu use logical side data attributes (`data-side="inline-start"`, `data-side="inline-end"`) that automatically mirror in RTL. The CSS overrides above cover animation edge cases and calendar navigation.

**Calendar also includes built-in RTL class handling:**
```tsx
String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
```
These Tailwind v4 RTL variants flip the chevron icons automatically.

## Tailwind v4 Theme

`app/globals.css` uses `@theme inline` to define shadcn color tokens as Tailwind v4 CSS variables:

```css
@theme inline {
  --color-background: oklch(1 0 0);
  --color-popover: oklch(1 0 0);
  --color-border: oklch(0.922 0 0);
  /* ... all shadcn color tokens ... */
}
```

This replaces the v3 `@layer base { :root { --background: ... } }` + `@apply bg-background` approach.

## Showcase Page

File: `app/dev/rtl-showcase/page.tsx` — accessible at `/dev/rtl-showcase` in dev mode.

**Important deviation:** Page is at `dev/rtl-showcase` not `_dev/rtl-showcase`. Next.js App Router treats `_`-prefixed folders as private (excluded from routing). The plan stated otherwise, but testing confirmed `_dev/` is not routed. Rule 3 auto-fix applied: renamed to `dev/`.

Page renders:
- Section 1: Popover with Hebrew button label `פתח Popover`
- Section 2: Calendar (react-day-picker single-mode date picker)
- Section 3: Dropdown Menu with Hebrew labels `פעולות`, `ערוך`, `שכפל`, `מחק`, and trigger `פתח תפריט`

All three sections include instructions for human visual verification per D-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tailwind v3 → v4 upgrade required by shadcn v4**
- **Found during:** Task 3 — `pnpm build` failed with `border-border class does not exist`
- **Issue:** shadcn@4.7.0 generates code for Tailwind v4 (`@import "shadcn/tailwind.css"`, `@theme`, `@custom-variant`), incompatible with the Tailwind v3 project
- **Fix:** Upgraded tailwindcss 3.4.x → 4.3.0; added `@tailwindcss/postcss`; updated `postcss.config.mjs`; rewrote `globals.css` to use `@import "tailwindcss"` + `@theme inline` color tokens
- **Files modified:** `package.json`, `pnpm-lock.yaml`, `postcss.config.mjs`, `app/globals.css`
- **Commit:** 4a5b980

**2. [Rule 1 - Bug] calendar.tsx `table` classname incompatible with react-day-picker v10**
- **Found during:** Task 3 — `pnpm tsc --noEmit` failed with `'table' does not exist in type 'Partial<ClassNames>'`
- **Issue:** shadcn-generated calendar.tsx used `table: "w-full border-collapse"` but react-day-picker v10 renamed this key to `month_grid`
- **Fix:** Changed `table` → `month_grid` in `components/ui/calendar.tsx`
- **Files modified:** `components/ui/calendar.tsx`
- **Commit:** 4a5b980

**3. [Rule 3 - Blocking] `_dev/` folder not routable in Next.js App Router**
- **Found during:** Task 4 — `pnpm build` output showed no `/_dev/rtl-showcase` route
- **Issue:** Next.js App Router treats `_`-prefixed segment folders as private (excluded from routing)
- **Fix:** Created showcase at `app/dev/rtl-showcase/page.tsx` (routed at `/dev/rtl-showcase`)
- **Files modified:** `app/dev/rtl-showcase/page.tsx` (new location)
- **Commit:** ba20c50

**4. [Rule 1 - Architecture Diff] shadcn v4 uses Base UI not Radix UI**
- **Found during:** Task 3 — shadcn@4.7.0 installs `@base-ui/react` instead of `@radix-ui/react-*`
- **Impact:** RTL CSS overrides adapted for Base UI's `data-side="inline-start/inline-end"` logical side attributes; `asChild` prop replaced with `render` prop pattern; Radix-specific selectors (`[data-radix-popper-content-wrapper]`) are not applicable
- **No fix required:** Base UI has better RTL support out of the box; all overrides in globals.css updated accordingly

## Known Stubs

None — all components are wired with real data (date picker state, Hebrew labels).

## Checkpoint (Task 5 — Awaiting)

Visual verification of RTL correctness at `/dev/rtl-showcase` is pending human approval. See the plan for the full verification protocol (D-02).

## Self-Check

Pending — will be completed after checkpoint resolution.
