# DB Preflight Check — Design Spec

**Date:** 2026-05-19  
**Status:** Approved

## Problem

`pnpm dev` starts Next.js before any DB connection is attempted. First request that touches the DB fails with a cryptic Drizzle/pg error. Developer must dig through the overlay to find the root cause.

## Goal

Run a DB connectivity check before `next dev` starts. Hard-fail with an actionable error message if the DB is unreachable. Zero prod overhead.

## Approach

`predev` npm lifecycle hook runs `tsx scripts/check-db.ts` automatically before `next dev`.

## Components

### `scripts/check-db.ts`

- Load env: `dotenv` with `.env.local` → `.env` fallback (matches `lib/db/client.ts` pattern)
- Guard: if `DATABASE_URL` missing → print message + `process.exit(1)`
- Connect: create `pg.Pool`, run `SELECT 1` with 5 s connect timeout
- Success: print `✓ Database reachable` + `process.exit(0)`
- Failure: pipe error through `rethrowWithDatabaseHint` (re-exported from `lib/db/client.ts`), print formatted hint + `process.exit(1)`
- Always: call `pool.end()` in `finally` to avoid hanging

### `package.json`

Add to `scripts`:
```json
"predev": "tsx scripts/check-db.ts"
```

## Error output format

```
✗ Database check failed
  DATABASE_URL not set. Add it to .env.local.
```

```
✗ Database check failed
  could not resolve db.abc123.supabase.co. If this is a Supabase direct
  database host, it may be IPv6-only; use the Supabase pooler connection
  string in DATABASE_URL, or run from an IPv6-capable network.
```

## Constraints

- No new deps — uses `pg`, `dotenv`, `tsx` (all present)
- Script stays under 50 lines
- Does NOT affect `pnpm build`, `pnpm start`, or test runs
- Reuses `rethrowWithDatabaseHint` — no duplicate hint logic

## Files Changed

| File | Change |
|------|--------|
| `scripts/check-db.ts` | New — ~40 lines |
| `package.json` | Add `"predev"` script |
