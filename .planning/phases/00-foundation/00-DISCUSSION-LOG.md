# Phase 0: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 00-foundation
**Areas discussed:** shadcn RTL patch strategy, CI trigger strategy

---

## shadcn RTL Patch Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| CSS logical props overrides | `[dir='rtl']` selectors in globals.css. No fork, no extra deps. Upgrade shadcn freely — re-test overrides after upgrade. | ✓ |
| Wrap with RTL logic | Thin wrapper components (RTLPopover, etc.) flipping props/styles. More code, fully controlled. | |
| Community RTL fork/plugin | Community-maintained RTL variant. Less upfront work, dep may fall behind upstream. | |

**User's choice:** CSS logical props overrides
**Notes:** Simple, maintainable, no additional dependencies.

---

## shadcn RTL Validation Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Patch + validate all 3 now | Prove patches work in placeholder page with dev-only showcase. Matches INFRA-05 acceptance criteria. | ✓ |
| Patch approach only, validate on use | Set up override strategy now, test each component when first used in later phases. | |

**User's choice:** Patch + validate all 3 now
**Notes:** INFRA-05 acceptance criteria is proven in-phase.

---

## CI Trigger Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| PRs + main only | CI on all pull requests and pushes to main. Feature branches don't trigger until PR opened. | ✓ |
| All branches | Every push anywhere triggers CI. More feedback, more noise, higher cost. | |

**User's choice:** PRs + main only

---

## Branch Protection

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, protect main | No direct commits. PRs required. CI must pass before merge. | ✓ |
| Soft protection (CI only) | CI runs, direct pushes to main still allowed. | |
| No protection for now | Skip GitHub branch protection settings entirely. | |

**User's choice:** Yes, protect main
**Notes:** Aligns with CLAUDE.md "never commit directly to main".

---

## Claude's Discretion

- Placeholder page visual design (content beyond שלום עולם)
- Node version pinning strategy
- Whether to include .env.example stub

## Deferred Ideas

None mentioned during discussion.
