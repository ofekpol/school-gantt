---
phase: 00-foundation
plan: 01
subsystem: infra
tags: [nextjs, react, typescript, tailwind, eslint, prettier, pnpm, rtl, hebrew]

# Dependency graph
requires: []
provides:
  - Next.js 15 App Router project scaffolded and runnable
  - TypeScript 5 strict mode config with bundler module resolution and @/* alias
  - Tailwind CSS v3 wired to app/, components/, lib/ content paths
  - ESLint 9 flat config with no-any and no-unused-vars rules
  - Prettier with prettier-plugin-tailwindcss
  - Hebrew RTL root layout: <html dir="rtl" lang="he">
  - Placeholder home page rendering שלום עולם
  - [dir="rtl"] CSS placeholder block in globals.css for Plan 02 shadcn patches
  - pnpm-lock.yaml (pnpm 9.12.0)
  - .env.example with all five required environment variable names
  - README.md with quickstart commands and stack listing
affects: [00-02, 00-03, all subsequent phases]

# Tech tracking
tech-stack:
  added:
    - next@15.5.18
    - react@19.2.6
    - react-dom@19.2.6
    - typescript@5.9.3
    - tailwindcss@3.4.19
    - autoprefixer@10.5.0
    - postcss@8.5.14
    - eslint@9.39.4
    - eslint-config-next@15.5.18
    - "@eslint/eslintrc@3.3.5"
    - prettier@3.8.3
    - prettier-plugin-tailwindcss@0.6.14
    - "@types/node@20.19.40"
    - "@types/react@19.2.14"
    - "@types/react-dom@19.2.3"
  patterns:
    - Server Components by default — no "use client" on layout or page
    - CSS logical properties for RTL (ms-*, me-*, ps-*, pe-*, text-start, text-end)
    - Tailwind content paths: ./app/**/*.{ts,tsx}, ./components/**/*.{ts,tsx}, ./lib/**/*.{ts,tsx}
    - TypeScript strict mode + bundler moduleResolution + @/* path alias
    - ESLint flat config (eslint.config.mjs) — no legacy .eslintrc

key-files:
  created:
    - package.json
    - pnpm-lock.yaml
    - tsconfig.json
    - tailwind.config.ts
    - eslint.config.mjs
    - postcss.config.mjs
    - next.config.ts
    - .prettierrc.json
    - .nvmrc
    - .gitignore
    - .env.example
    - app/layout.tsx
    - app/page.tsx
    - app/globals.css
    - README.md
  modified: []

key-decisions:
  - "typedRoutes moved top-level in next.config.ts (Next.js 15.5 moved it out of experimental)"
  - "pnpm installed via npm install -g pnpm since it was not in PATH (pnpm 9.12.0)"
  - "tsconfig.tsbuildinfo added to .gitignore as generated build artifact"

patterns-established:
  - "Server Component by default: no 'use client' unless hooks or browser APIs needed"
  - "RTL layout: set dir=rtl and lang=he on <html> root, use Tailwind logical utilities"
  - "Tailwind content scan covers app/, components/, lib/ — add new dirs when introduced"

requirements-completed: [INFRA-01]

# Metrics
duration: 5min
completed: 2026-05-09
---

# Phase 0 Plan 01: Next.js 15 + React 19 + TypeScript strict scaffold with Hebrew RTL placeholder

**Next.js 15.5 App Router + React 19 + TypeScript strict scaffolded with Tailwind CSS, ESLint 9, Prettier, and a Hebrew RTL placeholder page rendering שלום עולם at localhost:3000.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-08T22:28:13Z
- **Completed:** 2026-05-09T00:00:00Z
- **Tasks:** 3 of 3 (Task 3 checkpoint:human-verify approved by user)
- **Files modified:** 15

## Accomplishments

- All 11 root config files created: package.json, tsconfig.json, tailwind.config.ts, eslint.config.mjs, postcss.config.mjs, next.config.ts, .prettierrc.json, .nvmrc, .gitignore, .env.example, pnpm-lock.yaml
- App files created: app/layout.tsx with `<html dir="rtl" lang="he">`, app/page.tsx with Hebrew שלום עולם, app/globals.css with Tailwind directives and RTL placeholder block
- `pnpm tsc --noEmit` exits 0, `pnpm lint` exits 0, `pnpm build` exits 0 — full toolchain verified

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Next.js 15 + React 19 + TypeScript strict project** - `ef4be06` (chore)
2. **Task 2: Create RTL Hebrew root layout, placeholder home page, and global Tailwind styles** - `f9bedb4` (feat)
3. **Task 3: Visual verification checkpoint — human-approved** - No separate commit (checkpoint:human-verify approved by user confirming RTL render at localhost:3000)

## Files Created/Modified

- `package.json` — Project manifest with all required scripts (dev, build, lint, tsc, test, playwright)
- `pnpm-lock.yaml` — Generated lockfile (pnpm 9.12.0, 349 packages installed)
- `tsconfig.json` — TypeScript strict mode, ES2022 target, bundler resolution, @/* alias
- `tailwind.config.ts` — Content paths: app/, components/, lib/
- `eslint.config.mjs` — ESLint 9 flat config, next/core-web-vitals + next/typescript, no-any + no-unused-vars
- `postcss.config.mjs` — Tailwind + autoprefixer plugins
- `next.config.ts` — reactStrictMode + typedRoutes (top-level, not experimental)
- `.prettierrc.json` — Prettier config with prettier-plugin-tailwindcss
- `.nvmrc` — Node 20.11.0 pinned
- `.gitignore` — Covers node_modules, .next, .env, coverage, playwright-report, tsconfig.tsbuildinfo
- `.env.example` — All 5 environment variable names (no values)
- `app/layout.tsx` — Root layout, Server Component, `<html dir="rtl" lang="he">`, Tailwind body
- `app/page.tsx` — Placeholder page, Server Component, renders שלום עולם
- `app/globals.css` — @tailwind directives, RTL font stack, `[dir="rtl"]` placeholder block
- `README.md` — Quickstart with pnpm commands and stack listing

## Decisions Made

- **typedRoutes moved out of `experimental`:** Next.js 15.5.18 moved `typedRoutes` to a top-level config key. The plan specified `experimental: { typedRoutes: true }` but the build emitted a deprecation warning. Fixed inline (Rule 1 - Bug).
- **pnpm installed via npm:** pnpm was not in PATH on this machine. Installed with `npm install -g pnpm` (pnpm 9.12.0 matches `packageManager` field in package.json). This is a machine setup action, not a project change.
- **tsconfig.tsbuildinfo gitignored:** Generated by `tsc --incremental`, should never be committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `typedRoutes` placement in next.config.ts**
- **Found during:** Task 2 (pnpm build verification)
- **Issue:** Next.js 15.5.18 moved `typedRoutes` from `experimental.typedRoutes` to a top-level `typedRoutes` key. The plan's `next.config.ts` spec used the old location and produced a deprecation warning in the build output.
- **Fix:** Moved `typedRoutes: true` to top-level in next.config.ts; removed empty `experimental: {}` block.
- **Files modified:** `next.config.ts`
- **Verification:** `pnpm build` exits 0 with no warnings.
- **Committed in:** `f9bedb4` (Task 2 commit)

**2. [Rule 3 - Blocking] Installed pnpm via npm**
- **Found during:** Task 1 (pnpm install step)
- **Issue:** `pnpm` was not installed on the machine and not in PATH.
- **Fix:** Ran `npm install -g pnpm` to install pnpm 9.12.0 (exact version matching `packageManager` in package.json).
- **Files modified:** None (system-level installation)
- **Verification:** `pnpm --version` returns 9.12.0; `pnpm install` completes successfully.

**3. [Rule 2 - Missing Critical] Added tsconfig.tsbuildinfo to .gitignore**
- **Found during:** Task 1 (post-install git status check)
- **Issue:** Running `tsc --incremental` generates `tsconfig.tsbuildinfo` which should not be committed; it was untracked after `pnpm tsc --noEmit`.
- **Fix:** Added `tsconfig.tsbuildinfo` to `.gitignore`.
- **Files modified:** `.gitignore`
- **Committed in:** `f9bedb4` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None for this plan — no external services configured yet. `.env.example` documents the variable names for future setup in Plan 02+.

## Known Stubs

- `app/page.tsx`: Placeholder page with שלום עולם only. This is intentional — the full UI is delivered in later phases. The stub fulfills INFRA-01 (proves RTL toolchain works).
- `app/globals.css`: `[dir="rtl"] {}` block is empty placeholder. Will be populated in Plan 02 Task 3 with shadcn RTL overrides.

## Next Phase Readiness

- Toolchain fully operational: Next.js 15.5, React 19, TypeScript strict, Tailwind, ESLint, Prettier
- `pnpm dev`, `pnpm build`, `pnpm tsc --noEmit`, `pnpm lint` all exit 0
- INFRA-01 SATISFIED: user visually confirmed localhost:3000 renders שלום עולם RTL with `<html dir="rtl" lang="he">` in DevTools
- Plan 02 adds: shadcn/ui, Vitest, Playwright, next-intl

## Self-Check: PASSED

All 15 files verified present. Both task commits (ef4be06, f9bedb4) confirmed in git log. Key content assertions all passed: dev script, tsc script, strict mode, @/* alias, dir=rtl, lang=he, Hebrew text, Tailwind directives, [dir="rtl"] block, .env.example vars, .gitignore entries.

---
*Phase: 00-foundation*
*Completed: 2026-05-09*
