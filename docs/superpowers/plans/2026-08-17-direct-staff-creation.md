# Direct Staff Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a school admin add a staff user directly by email + role/scopes from the admin staff page, issuing a random one-time temporary password that the admin relays to the user, with a forced password change on first login.

**Architecture:** Revives plumbing that existed before commit `b53ae20` and was disabled (`POST /api/v1/admin/staff` currently returns a hardcoded `405`). A new `generateTempPassword()` helper produces a random per-user password. A new `createStaffUserDirect()` DB helper creates the Supabase Auth user (via `supabaseAdmin.auth.admin.createUser`) then the `staff_users` + `editor_scopes` rows inside `withSchool`, rolling back the auth user if the DB write fails. The route wires these together and returns the temp password once; the UI shows it once and never persists or emails it. The existing `mustChangePassword` gate (already live for a different, currently-unused purpose) forces the new user to set their own password before reaching `/dashboard` or `/admin`.

**Tech Stack:** Next.js 15 App Router route handler, Drizzle ORM + Postgres RLS (`withSchool`), Supabase Auth admin API, Zod, next-intl, Vitest (unit + integration), Playwright.

## Global Constraints

- Every school-scoped DB query must run inside `db.withSchool(schoolId, fn)` — no exceptions.
- `supabaseAdmin` (service-role client) is importable only from inside `lib/db/`.
- Parameterized queries only — no SQL string interpolation.
- Strict TypeScript, no `any`.
- `snake_case` DB columns → `camelCase` frontend types, transformed at the API route layer.
- Functions < 50 lines, files < 400 lines.
- All user-visible strings go through `next-intl` `t()` — no string literals in JSX.
- CSS logical properties only (`start`/`end`) — not applicable to this plan (no new positioned layout).
- Temp password must be randomly generated per user, never a fixed/shared string, and shown to the admin exactly once (on-screen only, never emailed, never logged, never persisted client-side).

---

### Task 1: Temporary password generator

**Files:**
- Create: `lib/auth/password.ts`
- Test: `test/unit/auth/password.test.ts`

**Interfaces:**
- Produces: `generateTempPassword(length?: number): string` — exported function. Default `length` is `10`. Output uses only characters from the set `ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789` (excludes `0/O/1/l/I` to avoid visual ambiguity), and is guaranteed to contain at least one uppercase letter, one lowercase letter, and one digit.

- [ ] **Step 1: Write the failing test**

Create `test/unit/auth/password.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateTempPassword } from "@/lib/auth/password";

const ALLOWED_CHARS = /^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789]+$/;

describe("generateTempPassword", () => {
  it("defaults to length 10", () => {
    expect(generateTempPassword()).toHaveLength(10);
  });

  it("respects a custom length", () => {
    expect(generateTempPassword(14)).toHaveLength(14);
  });

  it("only uses unambiguous charset characters", () => {
    const password = generateTempPassword(50);
    expect(password).toMatch(ALLOWED_CHARS);
  });

  it("never contains ambiguous characters 0, O, 1, l, I", () => {
    const password = generateTempPassword(200);
    expect(password).not.toMatch(/[0O1lI]/);
  });

  it("always contains at least one uppercase letter, one lowercase letter, and one digit", () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTempPassword();
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
    }
  });

  it("generates distinct passwords across many calls", () => {
    const passwords = Array.from({ length: 500 }, () => generateTempPassword());
    expect(new Set(passwords).size).toBe(passwords.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/auth/password.test.ts`
Expected: FAIL with "Cannot find module '@/lib/auth/password'" (or similar — the file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `lib/auth/password.ts`:

```typescript
import "server-only";
import { randomInt } from "node:crypto";

const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const CHARSET = UPPER + LOWER + DIGITS;

/**
 * Random per-user temporary password for admin-created staff accounts.
 * Excludes 0/O/1/l/I so an admin can read and relay it without ambiguity.
 * Never reused across users — see docs/superpowers/specs/2026-08-17-direct-staff-creation-design.md.
 */
export function generateTempPassword(length = 10): string {
  const required = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGITS[randomInt(DIGITS.length)],
  ];
  const rest = Array.from({ length: length - required.length }, () => CHARSET[randomInt(CHARSET.length)]);
  const chars = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/unit/auth/password.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/password.ts test/unit/auth/password.test.ts
git commit -m "feat: add random temp password generator for direct staff creation"
```

---

### Task 2: `createStaffUserDirect` DB helper

**Files:**
- Modify: `lib/db/staff.ts` (insert new function after `createStaffUserFromInvite`, i.e. after its closing `}` and before the `createStaffUserFromEmailSignup` doc comment)
- Test: `test/unit/db/staff-direct-creation.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm })` and `supabaseAdmin.auth.admin.deleteUser(id)` from `@/lib/db/supabase-admin`; `withSchool` from `@/lib/db/client`; `staffUsers`, `editorScopes` from `@/lib/db/schema` (all already imported at the top of `lib/db/staff.ts`).
- Produces: `createStaffUserDirect(params: { schoolId: string; email: string; fullName: string; role: "editor" | "admin" | "viewer"; password: string; gradeScopes?: number[]; eventTypeScopes?: string[] }): Promise<{ id: string }>` — exported from `@/lib/db/staff`. Throws an `Error` (message from Supabase, or the DB error) on failure; a duplicate email surfaces as an `Error` whose message contains "already registered" (Supabase's own wording) so the API route in Task 4 can pattern-match it.

- [ ] **Step 1: Write the failing test**

Create `test/unit/db/staff-direct-creation.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";

const withSchoolMock = vi.fn();
const createUserMock = vi.fn();
const deleteUserMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {},
  withSchool: (...args: unknown[]) => withSchoolMock(...args),
}));

vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (...args: unknown[]) => createUserMock(...args),
        deleteUser: (...args: unknown[]) => deleteUserMock(...args),
      },
    },
  },
}));

import { createStaffUserDirect } from "@/lib/db/staff";

const SCHOOL = "00000000-0000-0000-0000-000000000001";
const AUTH_USER = "00000000-0000-0000-0000-000000000002";

interface InsertCall {
  table: unknown;
  rows: unknown;
}

function makeTx(insertCalls: InsertCall[]) {
  return {
    insert: (table: unknown) => ({
      values: (rows: unknown) => {
        insertCalls.push({ table, rows });
        return Promise.resolve([]);
      },
    }),
  };
}

let insertCalls: InsertCall[];

beforeEach(() => {
  withSchoolMock.mockReset();
  createUserMock.mockReset();
  deleteUserMock.mockReset();
  insertCalls = [];
  withSchoolMock.mockImplementation(async (_schoolId: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(makeTx(insertCalls)),
  );
});

describe("createStaffUserDirect", () => {
  it("creates the auth user, then staff_users with mustChangePassword=true, then scopes", async () => {
    createUserMock.mockResolvedValue({ data: { user: { id: AUTH_USER } }, error: null });

    const result = await createStaffUserDirect({
      schoolId: SCHOOL,
      email: "new-editor@school.test",
      fullName: "New Editor",
      role: "editor",
      password: "Temp1234xy",
      gradeScopes: [9],
      eventTypeScopes: ["trip"],
    });

    expect(result).toEqual({ id: AUTH_USER });
    expect(createUserMock).toHaveBeenCalledWith({
      email: "new-editor@school.test",
      password: "Temp1234xy",
      email_confirm: true,
    });
    expect(withSchoolMock).toHaveBeenCalledWith(SCHOOL, expect.any(Function));

    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0].table).toBe(schema.staffUsers);
    expect(insertCalls[0].rows).toMatchObject({
      id: AUTH_USER,
      schoolId: SCHOOL,
      email: "new-editor@school.test",
      fullName: "New Editor",
      role: "editor",
      status: "active",
      mustChangePassword: true,
    });
    expect(insertCalls[1].table).toBe(schema.editorScopes);
    expect(insertCalls[1].rows).toEqual([
      { staffUserId: AUTH_USER, schoolId: SCHOOL, scopeKind: "grade", scopeValue: "9" },
      { staffUserId: AUTH_USER, schoolId: SCHOOL, scopeKind: "event_type", scopeValue: "trip" },
    ]);
  });

  it("does not insert scope rows when none are given", async () => {
    createUserMock.mockResolvedValue({ data: { user: { id: AUTH_USER } }, error: null });

    await createStaffUserDirect({
      schoolId: SCHOOL,
      email: "new-admin@school.test",
      fullName: "New Admin",
      role: "admin",
      password: "Temp1234xy",
    });

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe(schema.staffUsers);
  });

  it("throws without touching the DB when the email is already registered", async () => {
    createUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Email already registered" },
    });

    await expect(
      createStaffUserDirect({
        schoolId: SCHOOL,
        email: "dupe@school.test",
        fullName: "Dupe",
        role: "editor",
        password: "Temp1234xy",
      }),
    ).rejects.toThrow(/already registered/i);

    expect(withSchoolMock).not.toHaveBeenCalled();
  });

  it("rolls back the auth user and rethrows when the DB write fails", async () => {
    createUserMock.mockResolvedValue({ data: { user: { id: AUTH_USER } }, error: null });
    withSchoolMock.mockRejectedValue(new Error("unique constraint violation"));
    deleteUserMock.mockResolvedValue({ error: null });

    await expect(
      createStaffUserDirect({
        schoolId: SCHOOL,
        email: "new-editor@school.test",
        fullName: "New Editor",
        role: "editor",
        password: "Temp1234xy",
      }),
    ).rejects.toThrow("unique constraint violation");

    expect(deleteUserMock).toHaveBeenCalledWith(AUTH_USER);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/db/staff-direct-creation.test.ts`
Expected: FAIL — `createStaffUserDirect` is not exported from `@/lib/db/staff`

- [ ] **Step 3: Write minimal implementation**

In `lib/db/staff.ts`, insert the following function immediately after the closing `}` of `createStaffUserFromInvite` (after line 95) and before the `/** Creates a staff_users row for a user who registered via email/password. ... */` comment on `createStaffUserFromEmailSignup`:

```typescript
/** Builds editor_scopes insert rows for a staff user. Shared by direct creation. */
function buildScopeRows(
  staffUserId: string,
  schoolId: string,
  gradeScopes?: number[],
  eventTypeScopes?: string[],
): Array<{
  staffUserId: string;
  schoolId: string;
  scopeKind: "grade" | "event_type";
  scopeValue: string;
}> {
  return [
    ...(gradeScopes ?? []).map((g) => ({
      staffUserId,
      schoolId,
      scopeKind: "grade" as const,
      scopeValue: String(g),
    })),
    ...(eventTypeScopes ?? []).map((k) => ({
      staffUserId,
      schoolId,
      scopeKind: "event_type" as const,
      scopeValue: k,
    })),
  ];
}

/**
 * Creates an active staff user directly (admin-add-by-email flow), skipping the
 * invite-link step. Creates the Supabase Auth user with `params.password` first
 * (email_confirm: true so no confirmation email is required), then the staff_users
 * + editor_scopes rows. mustChangePassword is always true — the caller-supplied
 * password is a temporary one the admin relays to the user out of band.
 * Rolls back the auth user if the DB write fails, to avoid an orphaned login.
 */
export async function createStaffUserDirect(params: {
  schoolId: string;
  email: string;
  fullName: string;
  role: "editor" | "admin" | "viewer";
  password: string;
  gradeScopes?: number[];
  eventTypeScopes?: string[];
}): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser ${params.email}: ${error?.message ?? "unknown"}`);
  }
  const authUserId = data.user.id;

  try {
    await withSchool(params.schoolId, async (tx) => {
      await tx.insert(staffUsers).values({
        id: authUserId,
        schoolId: params.schoolId,
        email: params.email,
        fullName: params.fullName,
        role: params.role,
        status: "active",
        mustChangePassword: true,
      });

      const scopeRows = buildScopeRows(
        authUserId,
        params.schoolId,
        params.gradeScopes,
        params.eventTypeScopes,
      );
      if (scopeRows.length > 0) {
        await tx.insert(editorScopes).values(scopeRows);
      }
    });
  } catch (dbError) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {
      // best effort — DB write failed so nothing references this auth user, but
      // if the delete also fails there's nothing more we can safely do here
    });
    throw dbError;
  }

  return { id: authUserId };
}
```

`buildScopeRows` is a new private (non-exported) helper scoped to this file — it keeps `createStaffUserDirect` under the project's 50-line function limit. It is not wired into the existing `createStaffUserFromInvite`, which is untouched by this plan.

Note: the error message deliberately includes Supabase's own wording ("createUser <email>: Email already registered") rather than a re-phrased one, so the string-matching in Task 4's route handler (`msg.toLowerCase().includes("already registered")`) works against the real Supabase error text.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/unit/db/staff-direct-creation.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full unit suite to check for regressions**

Run: `pnpm vitest run test/unit`
Expected: PASS (no regressions in other files that import `@/lib/db/staff`)

- [ ] **Step 6: Commit**

```bash
git add lib/db/staff.ts test/unit/db/staff-direct-creation.test.ts
git commit -m "feat: add createStaffUserDirect for admin-add-by-email flow"
```

---

### Task 3: Integration test — real Postgres RLS + cross-school isolation

**Files:**
- Create: `test/integration/staff-direct-creation.test.ts`

**Interfaces:**
- Consumes: `createStaffUserDirect` from `@/lib/db/staff` (Task 2); `testDb`, `skipIfNoTestDb`, `shouldSkip`, `testSchoolA`, `testSchoolB` from `./setup`.
- Produces: nothing consumed by later tasks — this is a leaf verification task.

This test mocks only the external Supabase Auth call (no real network calls, no secrets required in CI) while using the real Postgres test database for every DB assertion — the same technique already used in `test/integration/public-routes.test.ts` (mocks `@supabase/ssr` while exercising real middleware logic).

- [ ] **Step 1: Write the failing test**

Create `test/integration/staff-direct-creation.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const createUserMock = vi.fn();
const deleteUserMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (...args: unknown[]) => createUserMock(...args),
        deleteUser: (...args: unknown[]) => deleteUserMock(...args),
      },
    },
  },
}));

import { createStaffUserDirect } from "@/lib/db/staff";
import { listStaffUsers } from "@/lib/db/staff";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-04: Direct staff creation (admin-add-by-email)
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("ADMIN-04: admin creates a staff user directly", () => {
  beforeAll(() => {
    if (shouldSkip()) return;
    createUserMock.mockReset();
    deleteUserMock.mockReset();
  });

  it("creates staff_users + editor_scopes rows scoped to the admin's school, with mustChangePassword=true", async () => {
    const authUserId = randomUUID();
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });

    const email = `admin04-editor-${authUserId.slice(0, 8)}@test`;
    const result = await createStaffUserDirect({
      schoolId: testSchoolA,
      email,
      fullName: "Direct Editor",
      role: "editor",
      password: "Temp1234xy",
      gradeScopes: [10],
      eventTypeScopes: ["trip"],
    });

    expect(result.id).toBe(authUserId);

    const [row] = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.id, authUserId));
    expect(row.schoolId).toBe(testSchoolA);
    expect(row.status).toBe("active");
    expect(row.mustChangePassword).toBe(true);
    expect(row.role).toBe("editor");

    const scopes = await testDb!
      .select()
      .from(schema.editorScopes)
      .where(eq(schema.editorScopes.staffUserId, authUserId));
    expect(scopes).toHaveLength(2);
  });

  it("does not leak the created row into another school's listStaffUsers", async () => {
    const authUserId = randomUUID();
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });

    await createStaffUserDirect({
      schoolId: testSchoolA,
      email: `admin04-isolation-${authUserId.slice(0, 8)}@test`,
      fullName: "Isolation Check",
      role: "viewer",
      password: "Temp1234xy",
    });

    const schoolBStaff = await listStaffUsers(testSchoolB);
    expect(schoolBStaff.map((u) => u.id)).not.toContain(authUserId);

    const schoolAStaff = await listStaffUsers(testSchoolA);
    expect(schoolAStaff.map((u) => u.id)).toContain(authUserId);
  });

  it("rolls back the auth user when the DB insert fails (duplicate id)", async () => {
    const authUserId = randomUUID();
    // First call succeeds and creates the row...
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });
    await createStaffUserDirect({
      schoolId: testSchoolA,
      email: `admin04-conflict-${authUserId.slice(0, 8)}@test`,
      fullName: "Conflict Source",
      role: "viewer",
      password: "Temp1234xy",
    });

    // ...then a second call reuses the same auth id, so the staff_users insert
    // hits the primary key constraint and createStaffUserDirect must roll back.
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });
    deleteUserMock.mockResolvedValueOnce({ error: null });

    await expect(
      createStaffUserDirect({
        schoolId: testSchoolA,
        email: `admin04-conflict-2-${authUserId.slice(0, 8)}@test`,
        fullName: "Conflict Retry",
        role: "viewer",
        password: "Temp1234xy",
      }),
    ).rejects.toThrow();

    expect(deleteUserMock).toHaveBeenCalledWith(authUserId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="$DATABASE_URL" pnpm vitest run test/integration/staff-direct-creation.test.ts`
Expected: If `DATABASE_URL` is set to a reachable Postgres instance, this should already PASS since Task 2's implementation is in place (this task only adds test coverage, no new production code). If `DATABASE_URL` is not set, the suite reports 0 tests run (skipped) — that's expected and not a failure; note it and continue.

- [ ] **Step 3: If step 2 showed failures with a real DB, fix `lib/db/staff.ts` until they pass**

There is no new implementation step here — Task 2 already implemented `createStaffUserDirect`. This step exists only to close the loop if the integration test reveals a mismatch between the mocked unit test's assumptions and real Postgres behavior (for example, a column default that differs from what the mocked `tx.insert` accepted).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/integration/staff-direct-creation.test.ts`
Expected: PASS (3 tests) when `DATABASE_URL` is set and reachable; cleanly skipped otherwise.

- [ ] **Step 5: Commit**

```bash
git add test/integration/staff-direct-creation.test.ts
git commit -m "test: cover createStaffUserDirect RLS isolation and rollback against real Postgres"
```

---

### Task 4: Revive `POST /api/v1/admin/staff`

**Files:**
- Modify: `app/api/v1/admin/staff/route.ts`
- Test: `test/unit/admin/staff-route.test.ts`

**Interfaces:**
- Consumes: `getStaffUser` from `@/lib/auth/session`; `assertAdmin` from `@/lib/auth/admin`; `createStaffUserDirect`, `listStaffUsers` from `@/lib/db/staff` (Task 2); `generateTempPassword` from `@/lib/auth/password` (Task 1); `StaffUserCreateSchema` from `@/lib/validations/admin` (already exists, unmodified).
- Produces: `POST /api/v1/admin/staff` — `201 { id: string; email: string; temporaryPassword: string }` on success; consumed by `AddStaffForm` in Task 5.

- [ ] **Step 1: Write the failing test**

Create `test/unit/admin/staff-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getStaffUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getStaffUser: (...args: unknown[]) => getStaffUserMock(...args),
}));

const createStaffUserDirectMock = vi.fn();
const listStaffUsersMock = vi.fn();
vi.mock("@/lib/db/staff", () => ({
  createStaffUserDirect: (...args: unknown[]) => createStaffUserDirectMock(...args),
  listStaffUsers: (...args: unknown[]) => listStaffUsersMock(...args),
}));

const generateTempPasswordMock = vi.fn();
vi.mock("@/lib/auth/password", () => ({
  generateTempPassword: (...args: unknown[]) => generateTempPasswordMock(...args),
}));

import { POST } from "@/app/api/v1/admin/staff/route";

const ACTIVE_ADMIN = {
  id: "00000000-0000-0000-0000-0000000000a1",
  schoolId: "00000000-0000-0000-0000-00000000000a",
  role: "admin",
  status: "active",
  mustChangePassword: false,
  email: "admin@school.test",
  fullName: "School Admin",
};

const VALID_BODY = {
  email: "new-editor@school.test",
  fullName: "New Editor",
  role: "editor",
  gradeScopes: [9],
  eventTypeScopes: ["trip"],
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/admin/staff", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/v1/admin/staff", () => {
  beforeEach(() => {
    getStaffUserMock.mockReset();
    createStaffUserDirectMock.mockReset();
    listStaffUsersMock.mockReset();
    generateTempPasswordMock.mockReset();
    generateTempPasswordMock.mockReturnValue("Temp1234xy");
  });

  it("returns 401 when unauthenticated", async () => {
    getStaffUserMock.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not an admin", async () => {
    getStaffUserMock.mockResolvedValue({ ...ACTIVE_ADMIN, role: "editor" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(createStaffUserDirectMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the admin still has their own mustChangePassword pending", async () => {
    getStaffUserMock.mockResolvedValue({ ...ACTIVE_ADMIN, mustChangePassword: true });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(createStaffUserDirectMock).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid input", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    const res = await POST(makeRequest({ email: "not-an-email", role: "editor" }));
    expect(res.status).toBe(400);
    expect(createStaffUserDirectMock).not.toHaveBeenCalled();
  });

  it("creates the user and returns the generated temp password once", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    createStaffUserDirectMock.mockResolvedValue({ id: "new-staff-id" });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: "new-staff-id",
      email: "new-editor@school.test",
      temporaryPassword: "Temp1234xy",
    });
    expect(createStaffUserDirectMock).toHaveBeenCalledWith({
      schoolId: ACTIVE_ADMIN.schoolId,
      email: "new-editor@school.test",
      fullName: "New Editor",
      role: "editor",
      password: "Temp1234xy",
      gradeScopes: [9],
      eventTypeScopes: ["trip"],
    });
  });

  it("returns 409 duplicate_email when createStaffUserDirect reports an already-registered email", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    createStaffUserDirectMock.mockRejectedValue(
      new Error("createUser new-editor@school.test: Email already registered"),
    );

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("duplicate_email");
  });

  it("returns 500 create_failed for any other createStaffUserDirect error", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    createStaffUserDirectMock.mockRejectedValue(new Error("connection reset"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("create_failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/admin/staff-route.test.ts`
Expected: FAIL — the current `POST` handler always returns `405`, so the 401/403/400/201/409/500 assertions fail

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `app/api/v1/admin/staff/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { assertAdmin } from "@/lib/auth/admin";
import { createStaffUserDirect, listStaffUsers } from "@/lib/db/staff";
import { generateTempPassword } from "@/lib/auth/password";
import { StaffUserCreateSchema } from "@/lib/validations/admin";

export async function GET(): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }
  const staff = await listStaffUsers(user!.schoolId);
  return NextResponse.json({ staff }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }
  if (user.mustChangePassword) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = StaffUserCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const temporaryPassword = generateTempPassword();
  try {
    const result = await createStaffUserDirect({
      schoolId: user.schoolId,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      password: temporaryPassword,
      gradeScopes: parsed.data.gradeScopes ?? [],
      eventTypeScopes: parsed.data.eventTypeScopes ?? [],
    });
    return NextResponse.json(
      { id: result.id, email: parsed.data.email, temporaryPassword },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "duplicate_email" }, { status: 409 });
    }
    return NextResponse.json({ error: "create_failed", message: msg }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/unit/admin/staff-route.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the full unit suite and type check**

Run: `pnpm vitest run test/unit && pnpm tsc --noEmit`
Expected: Both PASS with no regressions

- [ ] **Step 6: Commit**

```bash
git add app/api/v1/admin/staff/route.ts test/unit/admin/staff-route.test.ts
git commit -m "feat: revive POST /api/v1/admin/staff for direct staff creation"
```

---

### Task 5: i18n keys + `AddStaffForm` + wire into admin staff page

**Files:**
- Modify: `messages/he.json` (add keys inside the `admin.staff` object)
- Modify: `messages/en.json` (add keys inside the `admin.staff` object)
- Create: `components/admin/AddStaffForm.tsx`
- Modify: `components/admin/InviteForm.tsx` (add `data-testid="invite-form"` to the `<form>` so Task 6's e2e test can distinguish it from `AddStaffForm`)
- Modify: `app/(admin)/admin/staff/page.tsx` (render `AddStaffForm` in a new section)

**Interfaces:**
- Consumes: `POST /api/v1/admin/staff` (Task 4) — request `{ email, fullName, role, gradeScopes?, eventTypeScopes? }`, success response `{ id, email, temporaryPassword }`; `ScopeFields` from `@/components/admin/ScopeFields` (existing, unmodified — same props as used by `InviteForm`); i18n keys `admin.staff.create`, `admin.staff.duplicateEmail`, `admin.staff.createError` (existing) plus the new keys added in this task.
- Produces: `AddStaffForm({ eventTypes: { key: string; labelHe: string }[] })` — no other task consumes this component directly (leaf of the plan except the e2e test in Task 6, which drives it via the DOM, not an import).

No unit test for this task — per project convention (`InviteForm.tsx`, which this mirrors, has no unit test either); UI wiring correctness for this kind of form is covered by the Task 6 e2e test instead.

- [ ] **Step 1: Add the new i18n keys to `messages/he.json`**

In `messages/he.json`, inside the `admin.staff` object, find this line:

```json
  "createError": "שגיאת יצירה",
```

Replace it with:

```json
  "createError": "שגיאת יצירה",
  "staffCreated": "המשתמש נוצר",
  "temporaryPassword": "סיסמה זמנית",
  "tempPasswordWarning": "הסיסמה מוצגת פעם אחת בלבד. יש להעתיק אותה עכשיו ולמסור אותה ל-{email} ישירות — היא לא תוצג שוב.",
  "copyPassword": "העתק סיסמה",
  "passwordCopied": "הסיסמה הועתקה",
```

- [ ] **Step 2: Add the matching keys to `messages/en.json`**

In `messages/en.json`, inside the `admin.staff` object, find this line:

```json
  "createError": "Creation error",
```

Replace it with:

```json
  "createError": "Creation error",
  "staffCreated": "User created",
  "temporaryPassword": "Temporary password",
  "tempPasswordWarning": "This password is shown only once. Copy it now and share it with {email} directly — it will not be shown again.",
  "copyPassword": "Copy password",
  "passwordCopied": "Password copied",
```

- [ ] **Step 3: Add `data-testid` to `InviteForm`**

In `components/admin/InviteForm.tsx`, change:

```tsx
    <form key={formKey} action={create} className="space-y-3 rounded border p-3">
```

to:

```tsx
    <form
      key={formKey}
      action={create}
      data-testid="invite-form"
      className="space-y-3 rounded border p-3"
    >
```

- [ ] **Step 4: Create `AddStaffForm`**

Create `components/admin/AddStaffForm.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouteProgress } from "@/components/RouteProgress";
import { ALL_GRADES, ScopeFields } from "@/components/admin/ScopeFields";

interface EventTypeRow {
  key: string;
  labelHe: string;
}

interface CreatedStaff {
  email: string;
  temporaryPassword: string;
}

export function AddStaffForm({ eventTypes }: { eventTypes: EventTypeRow[] }) {
  const t = useTranslations("admin.staff");
  const tc = useTranslations("common");
  const router = useRouter();
  const startRouteProgress = useRouteProgress();
  const [role, setRole] = useState<string>("editor");
  const [created, setCreated] = useState<CreatedStaff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formKey, setFormKey] = useState(0);

  async function create(form: FormData) {
    setError(null);
    setCreated(null);
    setCopied(false);
    const selectedRole = String(form.get("role") ?? "editor");
    const gradeScopes =
      selectedRole === "editor"
        ? ALL_GRADES.filter((g) => form.get(`add-staff-grade-${g}`) === "on")
        : [];
    const eventTypeScopes =
      selectedRole === "editor"
        ? eventTypes
            .filter((et) => form.get(`add-staff-type-${et.key}`) === "on")
            .map((et) => et.key)
        : [];
    const body = {
      email: String(form.get("email") ?? "").trim(),
      fullName: String(form.get("fullName") ?? "").trim(),
      role: selectedRole,
      gradeScopes,
      eventTypeScopes,
    };

    const res = await fetch("/api/v1/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error === "duplicate_email" ? t("duplicateEmail") : t("createError"));
      return;
    }
    const data = (await res.json()) as { email: string; temporaryPassword: string };
    setCreated({ email: data.email, temporaryPassword: data.temporaryPassword });
    setFormKey((k) => k + 1);
    startRouteProgress(2500);
    router.refresh();
  }

  function copyPassword(password: string) {
    void navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <form
      key={formKey}
      action={create}
      data-testid="add-staff-form"
      className="space-y-3 rounded border p-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="role"
          defaultValue="editor"
          className="rounded border px-2 py-1"
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="viewer">{t("roleViewer")}</option>
          <option value="editor">{t("roleEditor")}</option>
          <option value="admin">{t("roleAdmin")}</option>
        </select>
        <input
          name="email"
          type="email"
          required
          placeholder={t("email")}
          className="w-56 rounded border px-2 py-1"
          aria-label={t("email")}
        />
        <input
          name="fullName"
          type="text"
          required
          placeholder={t("fullName")}
          className="w-56 rounded border px-2 py-1"
          aria-label={t("fullName")}
        />
        <AddStaffSubmitButton label={t("create")} loadingLabel={tc("saving")} />
      </div>

      {role === "editor" && (
        <ScopeFields
          eventTypes={eventTypes}
          gradeName={(grade) => `add-staff-grade-${grade}`}
          typeName={(key) => `add-staff-type-${key}`}
          labels={{
            gradeScopes: t("gradeScopes"),
            eventTypeScopes: t("eventTypeScopes"),
            selectAllGrades: t("selectAllGrades"),
            clearAllGrades: t("clearAllGrades"),
            selectAllEventTypes: t("selectAllEventTypes"),
            clearAllEventTypes: t("clearAllEventTypes"),
          }}
          wrapperClassName="lg:grid-cols-1 xl:grid-cols-2"
          legendClassName="text-neutral-950"
          optionClassName="rounded-none border-0 px-0 py-0"
        />
      )}

      {created && (
        <div className="space-y-1 rounded border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">
            {t("staffCreated")}: {created.email}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-700">
              {t("temporaryPassword")}:{" "}
              <code className="rounded bg-white px-2 py-0.5 font-mono">
                {created.temporaryPassword}
              </code>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copyPassword(created.temporaryPassword)}
            >
              {copied ? t("passwordCopied") : t("copyPassword")}
            </Button>
          </div>
          <p className="text-xs text-neutral-600">
            {t("tempPasswordWarning", { email: created.email })}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

function AddStaffSubmitButton({
  label,
  loadingLabel,
}: {
  label: string;
  loadingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? loadingLabel : label}
    </Button>
  );
}
```

- [ ] **Step 5: Wire `AddStaffForm` into the admin staff page**

In `app/(admin)/admin/staff/page.tsx`, add the import:

```tsx
import { AddStaffForm } from "@/components/admin/AddStaffForm";
```

next to the existing `import { InviteForm } from "@/components/admin/InviteForm";` line, then add a new `<section>` immediately before the existing Invites `<section>` (the one starting with `<section className="sg-staff-card space-y-4 rounded-xl border bg-white p-4">`):

```tsx
      <section className="sg-staff-card space-y-3 rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">{t("create")}</h2>
        <AddStaffForm eventTypes={eventTypes} />
      </section>

```

- [ ] **Step 6: Type check and lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: Both PASS with no errors

- [ ] **Step 7: Manual verification in the dev server**

Run: `pnpm dev` (in the background), then open `/admin/staff` as an admin user, fill in the new "Create User" form with a fresh email, submit, and confirm the one-time temp password panel appears with a working copy button. Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add messages/he.json messages/en.json components/admin/AddStaffForm.tsx components/admin/InviteForm.tsx "app/(admin)/admin/staff/page.tsx"
git commit -m "feat: add AddStaffForm to admin staff page for direct staff creation"
```

---

### Task 6: E2E coverage

**Files:**
- Modify: `test/e2e/admin-staff.spec.ts`

**Interfaces:**
- Consumes: `data-testid="invite-form"` and `data-testid="add-staff-form"` (Task 5); `POST /api/v1/admin/staff` (Task 4) via the running app, not directly.

- [ ] **Step 1: Fix the now-stale comment and disambiguate the existing invite test's selector**

In `test/e2e/admin-staff.spec.ts`, replace:

```typescript
/**
 * Admin staff management (E2E).
 *
 * Uses the admin auth state created by global.setup.ts (test/e2e/.auth/admin.json)
 * instead of a UI login — the app authenticates via Google OAuth, so there is no
 * password form to drive. Requires ADMIN_E2E=1 and DATABASE_URL.
 *
 * Current model: admins onboard staff by issuing invite links (InviteForm) —
 * there is no direct "create user with temporary password" form.
 */
```

with:

```typescript
/**
 * Admin staff management (E2E).
 *
 * Uses the admin auth state created by global.setup.ts (test/e2e/.auth/admin.json)
 * instead of a UI login — the app authenticates via Google OAuth, so there is no
 * password form to drive. Requires ADMIN_E2E=1 and DATABASE_URL.
 *
 * Admins onboard staff two ways: invite links (InviteForm) or direct creation
 * with a one-time generated temp password (AddStaffForm). Both forms have an
 * `input[name="email"]`, so tests select by `data-testid` to avoid ambiguity.
 */
```

Then replace the existing invite test's form locator:

```typescript
  // Scope to the InviteForm (the only form with an email input).
  const form = page.locator('form:has(input[name="email"])');
```

with:

```typescript
  const form = page.getByTestId("invite-form");
```

- [ ] **Step 2: Add the new direct-creation e2e test**

Append to `test/e2e/admin-staff.spec.ts`, after the existing `test("ADMIN-01 e2e: ...")` block:

```typescript
test("ADMIN-04 e2e: admin creates a staff user directly and sees the one-time temp password", async ({
  page,
}) => {
  await page.goto("/admin/staff");

  const form = page.getByTestId("add-staff-form");
  await expect(form).toBeVisible();

  await form.locator('select[name="role"]').selectOption("viewer");
  const email = `e2e-direct-${Date.now()}@demo-school.test`;
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="fullName"]').fill("E2E Direct Viewer");
  await form.locator('button[type="submit"]').click();

  await expect(form.getByText(email, { exact: false })).toBeVisible({ timeout: 10_000 });
  await expect(form.locator("code")).toBeVisible();
});
```

- [ ] **Step 3: Run the e2e suite (requires a running app + DB + ADMIN_E2E=1)**

Run: `ADMIN_E2E=1 pnpm playwright test test/e2e/admin-staff.spec.ts`
Expected: PASS (2 tests) if the environment variables and a reachable app/DB are configured locally; if not, note that this is expected to be skipped (`test.skip(skip, ...)` at the top of the file already handles this) and move on.

- [ ] **Step 4: Commit**

```bash
git add test/e2e/admin-staff.spec.ts
git commit -m "test: add e2e coverage for direct staff creation, disambiguate invite form selector"
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full lint + type check**

Run: `pnpm lint && pnpm tsc --noEmit`
Expected: Both PASS

- [ ] **Step 2: Full unit + integration suite**

Run: `pnpm test`
Expected: PASS. Integration tests (`test/integration/*`) skip cleanly if `DATABASE_URL` is unset; if it is set, all `ADMIN-01` through `ADMIN-04` cases should pass.

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: PASS with no type or build errors

- [ ] **Step 4: Merge to main**

```bash
git checkout main
git pull --ff-only
git merge feature/direct-staff-creation
```

Expected: Fast-forward or clean merge, no conflicts (the branch was created from an up-to-date `main` in this session).

- [ ] **Step 5: Push (only if the user asks for it — do not push by default)**

```bash
git push origin main
```

---

## Spec Coverage Check

| Spec section | Task |
|---|---|
| `createStaffUserDirect` (auth user + staff_users + editor_scopes, rollback on failure) | Task 2, Task 3 |
| `generateTempPassword()` (random, unambiguous charset, upper/lower/digit) | Task 1 |
| `POST /api/v1/admin/staff` revived, 201/401/403/400/409 contract | Task 4 |
| `AddStaffForm` one-time reveal panel, on-screen only | Task 5 |
| Admin staff page wiring alongside existing Invites section | Task 5 |
| i18n keys (reuse `create`/`duplicateEmail`/`createError`, add new reveal-panel keys) | Task 5 |
| `mustChangePassword` gate on first login | No task — already implemented and unmodified; verified manually in Task 5 Step 7 and end-to-end in Task 6 |
| Integration tests: RLS positive + cross-school denial | Task 3 |
| E2E: create → one-time reveal | Task 6 |
| Stale e2e comment claiming "no direct creation form exists" | Task 6 Step 1 |
