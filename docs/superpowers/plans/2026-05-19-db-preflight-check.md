# DB Preflight Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a DB connectivity check before `next dev` starts and hard-fail with an actionable error message if the DB is unreachable.

**Architecture:** A `scripts/check-db.ts` script loads env vars, opens a `pg.Pool`, runs `SELECT 1` with a 5 s timeout, and exits 0 on success or 1 on failure. It is wired as a `predev` npm lifecycle hook so it runs automatically before `next dev`. Error messages are enhanced via the existing `rethrowWithDatabaseHint` function in `lib/db/client.ts`.

**Tech Stack:** `pg`, `dotenv`, `tsx` (all already installed); no new dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/check-db.ts` | Create | DB connectivity check script |
| `package.json` | Modify | Add `"predev"` script |

---

### Task 1: Create `scripts/check-db.ts`

**Files:**
- Create: `scripts/check-db.ts`

- [ ] **Step 1: Create the script**

```typescript
import { config } from "dotenv";
config({ path: ".env.local", override: false, quiet: true });
config({ override: false, quiet: true });

import { Pool } from "pg";
import { rethrowWithDatabaseHint } from "../lib/db/client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("✗ Database check failed");
    console.error("  DATABASE_URL not set. Add it to .env.local.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    console.log("✓ Database reachable");
  } catch (error) {
    console.error("✗ Database check failed");
    try {
      rethrowWithDatabaseHint(error, "");
    } catch (enhanced) {
      const msg = enhanced instanceof Error ? enhanced.message.replace(/^: /, "") : String(enhanced);
      console.error(`  ${msg}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors. If you see a module resolution error on `../lib/db/client`, check that `tsconfig.json` includes `scripts/` or that paths resolve correctly from `scripts/check-db.ts`.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-db.ts
git commit -m "feat: add DB preflight check script"
```

---

### Task 2: Wire `predev` hook in `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `predev` to scripts**

In `package.json`, inside the `"scripts"` block, add:

```json
"predev": "tsx scripts/check-db.ts",
```

The full `scripts` block becomes:

```json
"scripts": {
  "predev": "tsx scripts/check-db.ts",
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "tsc": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:unit": "vitest run --project unit",
  "test:integration": "vitest run --project integration",
  "seed": "tsx db/seed.ts",
  "seed:perf": "tsx db/seed-perf.ts",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "playwright": "playwright test",
  "format": "prettier --write ."
}
```

- [ ] **Step 2: Smoke-test success path**

With a valid `DATABASE_URL` in `.env.local`, run:

```bash
pnpm predev
```

Expected output:
```
✓ Database reachable
```

Exit code should be 0.

- [ ] **Step 3: Smoke-test missing `DATABASE_URL`**

Temporarily rename `.env.local` to `.env.local.bak`, then run:

```bash
pnpm predev
```

Expected output:
```
✗ Database check failed
  DATABASE_URL not set. Add it to .env.local.
```

Exit code should be 1. Restore `.env.local.bak` to `.env.local` after.

- [ ] **Step 4: Verify `pnpm build` unaffected**

```bash
pnpm build
```

Expected: builds normally (no preflight check runs — `predev` does not hook `build`).

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: wire DB preflight check as predev hook"
```
