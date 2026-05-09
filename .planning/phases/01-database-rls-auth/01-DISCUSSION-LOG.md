# Phase 1: Database, RLS & Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 01-database-rls-auth
**Areas discussed:** Supabase project setup

---

## Supabase Project Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Already provisioned | Project exists, env vars ready. Executor connects immediately. | ✓ |
| Need to create one | No project yet — executor runs `supabase init`, creates + links project. | |
| Local Supabase (Docker) | Running via `supabase start`. | |

**User's choice:** Already provisioned

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — all set | .env.local filled in, executor connects immediately. | |
| Partially — some missing | Executor hits checkpoint for missing values. | |
| No — will fill during execution | Executor pauses at human-action checkpoint before connecting. | ✓ |

**User's choice:** No — will fill during execution

**Notes:** Executor must emit a `checkpoint:human-action` early in execution to collect all four env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) before any Supabase connection attempt.

---

## Claude's Discretion

- Password reset + Resend integration approach (prefer Next.js route over Supabase edge function)
- Auth route protection strategy (middleware.ts vs per-layout)
- Failed-login lockout implementation (use `locked_until` column, DB tracking)

## Deferred Ideas

None.
