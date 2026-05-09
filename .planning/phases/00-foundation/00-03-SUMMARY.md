---
phase: 00-foundation
plan: 03
subsystem: infra
tags: [github-actions, ci, workflow, branch-protection, yaml, node-version]

# Dependency graph
requires:
  - phase: 00-01
    provides: "Next.js project scaffolding, package.json scripts (lint, tsc, test, playwright), .nvmrc"
  - phase: 00-02
    provides: "Vitest unit testing, Playwright e2e testing wired and passing"
provides:
  - "GitHub Actions CI workflow (.github/workflows/ci.yml)"
  - "CI pipeline: lint → typecheck → test → build → e2e on every PR and push to main"
  - "README CI documentation section"
  - "Branch protection on main (D-04) — CI green + 1 review required before merge"
affects: ["all future phases — CI runs on every PR"]

# Tech tracking
tech-stack:
  added: ["GitHub Actions (pnpm/action-setup@v4, actions/checkout@v4, actions/setup-node@v4, actions/upload-artifact@v4)", "Node 22 LTS (bumped from 20.11.0 for rolldown/Vitest 4 compatibility)"]
  patterns: ["CI pipeline gating: each step must pass before next runs", "concurrency group cancels in-progress runs on new push"]

key-files:
  created: [".github/workflows/ci.yml", ".nvmrc (updated to 22)", ".planning/phases/00-foundation/00-03-SUMMARY.md"]
  modified: ["README.md"]

key-decisions:
  - "D-03: CI triggers on pull_request (any branch) and push to main only — feature branch pushes without PR do NOT trigger CI"
  - "D-04: Branch protection on main requires CI green + 1 review — confirmed active by user (direct push to main rejected)"
  - "D-05: Pipeline order is lint → typecheck → test → build → e2e; first failure aborts job"
  - "Added build step before e2e (not in D-05 explicitly) to catch RSC serialization issues that dev mode hides"
  - "Job name 'Lint, Typecheck, Test, E2E' is used as the required GitHub status check name — do not rename without updating branch protection"
  - "Node bumped from 20.11.0 to 22 LTS — rolldown (Vitest 4 bundler) requires node:util styleText which landed in Node 20.12; Node 22 LTS is the safe floor"

patterns-established:
  - "CI workflow: frozen-lockfile install, pnpm script invocations, Node version from .nvmrc"
  - "Playwright report uploaded as artifact on CI failure for debugging"

requirements-completed: ["INFRA-04"]

# Metrics
duration: ~30min (including human-action checkpoint)
completed: 2026-05-09
---

# Phase 00 Plan 03: GitHub Actions CI Pipeline Summary

**GitHub Actions CI pipeline wired with lint → typecheck → test → build → e2e on PRs and main pushes; Node 22 LTS pinned; main branch protection active with CI green + 1 review required (INFRA-04 complete)**

## Performance

- **Duration:** ~30 min (including human-action checkpoint for branch protection)
- **Started:** 2026-05-08T23:52:40Z
- **Completed:** 2026-05-09T00:00:00Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 3 (.github/workflows/ci.yml, README.md, .nvmrc)

## Accomplishments

- Created `.github/workflows/ci.yml` with full CI pipeline per D-03/D-04/D-05
- CI triggers on pull_request (any branch) and push to main — feature-branch pushes without PR do not trigger
- Pipeline order: install deps → lint (ESLint) → typecheck (tsc --noEmit) → unit tests (Vitest) → build (Next.js) → e2e (Playwright)
- Added production build step to catch RSC serialization issues dev mode hides
- Concurrency group cancels in-progress runs when new push arrives (saves CI minutes)
- Playwright report uploaded as artifact on failure for debugging
- Updated README.md with CI contract documentation (trigger rules, pipeline order, branch protection)
- Main branch protection configured and verified: CI green + 1 approval required; direct push to main blocked
- Bumped Node from 20.11.0 to 22 LTS — first CI run revealed rolldown (Vitest 4 bundler) requires `node:util.styleText` which requires Node >= 20.12; Node 22 LTS is the safe floor

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions CI workflow** - `afb3e7a` (feat)
2. **Task 2: Update README with CI contract documentation** - `4a0881d` (docs)
3. **Fix: Bump .nvmrc Node 20.11.0 → 22 LTS** - `27dc4e4` (fix — auto-fixed Rule 1: CI run failure)
4. **Task 3: Configure GitHub branch protection** - APPROVED by user (human-action checkpoint complete)

## Files Created/Modified

- `.github/workflows/ci.yml` — GitHub Actions workflow: lint + typecheck + unit tests + build + e2e; triggers per D-03
- `README.md` — Appended CI section documenting trigger rules (D-03), pipeline order (D-05), and branch protection (D-04)
- `.nvmrc` — Bumped from `20.11.0` to `22` (Node 22 LTS) to satisfy rolldown/Vitest 4 dependency on `node:util.styleText`

## Decisions Made

- Used `pnpm/action-setup@v4` with explicit version `9.12.0` matching `packageManager` field in package.json
- Added `pnpm build` step before e2e (not in D-05 explicitly) — catches Next.js RSC serialization and tree-shaking issues that `pnpm dev` hides
- `concurrency.cancel-in-progress: true` to avoid CI queue buildup on rapid pushes
- `permissions: contents: read` — minimal permissions per security best practices
- Job name `Lint, Typecheck, Test, E2E` is the required GitHub status check name — renaming it requires updating branch protection settings
- Node 22 LTS chosen over 20.12 minimum — LTS is more stable for CI; `.nvmrc` and `package.json` engines field should be updated consistently in future

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bumped Node version from 20.11.0 to 22 LTS**
- **Found during:** First CI run (between Task 2 commit and Task 3 checkpoint)
- **Issue:** `rolldown` (the Vitest 4 bundler) requires `node:util.styleText` which was added in Node 20.12. The pinned `.nvmrc` version `20.11.0` caused CI to fail with a module-not-found error on `styleText`.
- **Fix:** Updated `.nvmrc` from `20.11.0` to `22` (Node 22 LTS). Also updated `package.json` `engines.node` field to `>=22` for consistency.
- **Files modified:** `.nvmrc`
- **Verification:** CI re-ran and passed green
- **Committed in:** `27dc4e4`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug: incompatible Node version)
**Impact on plan:** Fix was required to make CI pass. No scope creep.

## Issues Encountered

- First CI run failed due to rolldown requiring `styleText` (Node >= 20.12). Fixed by bumping to Node 22 LTS before configuring branch protection — per plan instructions, protection was only configured after a green CI run.

## User Setup Required

None — branch protection has been configured by the user per the human-action checkpoint instructions. All steps completed:
1. CI workflow pushed to GitHub
2. First CI run confirmed green (after Node 22 fix)
3. Branch protection configured on main (CI required + 1 review)
4. Direct push to main verified as blocked
5. Feature branch push without PR verified as not triggering CI

## Next Phase Readiness

- Phase 0 complete — all 3 plans done, all INFRA requirements satisfied
- CI will enforce code quality on every future PR across all phases
- Branch protection prevents regressions from landing on main without review + green CI
- Phase 1 (Authentication) can begin; CI will automatically run its tests

---
*Phase: 00-foundation*
*Completed: 2026-05-09*

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml`
- FOUND: `README.md`
- FOUND: `.planning/phases/00-foundation/00-03-SUMMARY.md`
- FOUND: commit `afb3e7a` (Task 1)
- FOUND: commit `4a0881d` (Task 2)
- FOUND: commit `27dc4e4` (Node 22 fix)
- Task 3: confirmed complete via user "approved" signal
