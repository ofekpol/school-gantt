# School Gantt Chart System

Multi-tenant school event calendar. Hebrew RTL by default.

## Quickstart

```bash
pnpm install
pnpm dev          # http://localhost:3000 → שלום עולם
pnpm tsc          # TypeScript check
pnpm lint         # ESLint
pnpm test         # Vitest (wired in Plan 02)
pnpm playwright   # Playwright e2e (wired in Plan 02)
```

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5 strict · Tailwind CSS · shadcn/ui · Supabase · Drizzle ORM · next-intl · Vitest · Playwright

## Project Structure

See `CLAUDE.md` for the canonical architecture map and conventions.

## Status

Phase 0: Foundation — in progress. See `.planning/ROADMAP.md`.

## CI

GitHub Actions runs on:
- Every pull request (any target branch)
- Every push to `main`

Feature-branch pushes without an open PR do NOT trigger CI — open a PR to run checks.

### Pipeline order

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` — ESLint
3. `pnpm tsc --noEmit` — TypeScript strict typecheck
4. `pnpm test` — Vitest unit + integration
5. `pnpm build` — Next.js production build
6. `pnpm playwright` — Playwright e2e (chromium)

First failing step aborts the job. Playwright report is uploaded as a workflow artifact on failure.

### Branch protection

`main` is protected:
- No direct pushes — all changes via PR
- CI must be green before merge
- At least 1 approving review required

See `.github/workflows/ci.yml` for the workflow definition.
