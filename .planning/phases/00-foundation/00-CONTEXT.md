# Phase 0: Foundation - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap the developer toolchain: Next.js 15 App Router + TypeScript strict + Tailwind + shadcn/ui scaffolded, Hebrew RTL rendering verified, Vitest + Playwright wired with zero tests passing, CI running lint + typecheck + test on every PR and push to main, and all 3 RTL-broken shadcn components (Popover, Calendar, Dropdown) patched and validated.

This phase delivers zero user-facing features — only a dev-operable, CI-protected repo that proves RTL works.

</domain>

<decisions>
## Implementation Decisions

### shadcn RTL Patches

- **D-01:** Use `[dir='rtl']` CSS logical property overrides in `globals.css` — no fork, no extra dependencies. Override only the broken properties (positioning, transform, alignment) for Popover, Calendar, and Dropdown.
- **D-02:** All 3 components must be patched AND validated in Phase 0 via a dev-only component showcase on the placeholder page. INFRA-05 acceptance is proven in-phase, not deferred to first use.

### CI Setup

- **D-03:** GitHub Actions. Triggers: pull requests to any branch + direct pushes to main. Feature branch pushes without a PR do not trigger CI.
- **D-04:** main is protected: no direct commits allowed, CI must pass before merge is unblocked. Enforces CLAUDE.md "never commit directly to main".
- **D-05:** CI steps: lint (ESLint) → typecheck (`tsc --noEmit`) → test (Vitest) → e2e (Playwright). All three must pass to unblock merge.

### Claude's Discretion

- Placeholder page design (INFRA-01 requires Hebrew RTL at localhost:3000 — exact content and visual treatment left to Claude)
- Node version pinning (`.nvmrc` or `engines` field in package.json — Claude decides)
- Whether Phase 0 includes a `.env.example` stub (no Supabase setup, just the variable names documented)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 0 Scope & File List
- `IMPLEMENTATION_PLAN.md` §5 Phase 0 — exact file list for Phase 0 deliverables (`package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.github/workflows/ci.yml`, `app/layout.tsx`, `app/page.tsx`, `README.md`)

### Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-05 are the acceptance criteria for this phase

### Stack & Constraints
- `CLAUDE.md` — code style, RTL constraint (logical properties only), git workflow, commands
- `.planning/PROJECT.md` — tech stack constraints, key decisions (A1/A2 Next.js App Router locked, G1 next-intl locked)
- `PRD_school_gantt_chart_system.md` §6.1 — auth/RTL context; §2 for overall goals

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — blank repo. All files are new.

### Established Patterns
- None yet — Phase 0 establishes the patterns that all subsequent phases follow.

### Integration Points
- `app/layout.tsx` — must set `<html dir="rtl" lang="he">` from day one (all phases depend on this)
- `globals.css` — RTL override location for shadcn patches (D-01)
- `.github/workflows/ci.yml` — CI entry point all phases will depend on

</code_context>

<specifics>
## Specific Ideas

- IMPLEMENTATION_PLAN.md explicitly names the Phase 0 files — use that list as the deliverable checklist
- The placeholder page should say *שלום עולם* (per implementation plan phrasing)
- shadcn RTL risk explicitly estimated at "half a day" in the implementation plan — budget accordingly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 00-foundation*
*Context gathered: 2026-05-09*
