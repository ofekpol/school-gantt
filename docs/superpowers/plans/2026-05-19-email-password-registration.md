# Email/Password Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password registration and sign-in alongside Google OAuth for staff users, with Supabase built-in email confirmation and immediate activation on confirm.

**Architecture:** `POST /api/v1/auth/register` calls `supabase.auth.signUp()` and returns `{ status: 'confirmation_sent' }`. `GET /auth/confirm` verifies the Supabase OTP token hash, inserts the `staff_users` row with `status='active'`, and redirects to login. `POST /api/v1/auth/signin` enforces the existing lockout schema fields before calling `signInWithPassword`. The login page gains an email/password tab alongside the Google button.

**Tech Stack:** Next.js 15 App Router, Supabase SSR (`@supabase/ssr`), Drizzle ORM, Zod, shadcn/ui, Vitest, Playwright

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `middleware.ts` | Add `/auth/confirm` and `/auth/register` to `PUBLIC_PATHS` |
| Modify | `lib/db/staff.ts` | Add `createStaffUserFromEmailSignup()` |
| Create | `app/api/v1/auth/register/route.ts` | POST — Zod validate → `signUp()` → 200/409/422 |
| Create | `app/api/v1/auth/signin/route.ts` | POST — lockout check → `signInWithPassword()` → 200/401/423 |
| Create | `app/auth/confirm/route.ts` | GET — `verifyOtp()` → insert staff_users → redirect |
| Create | `components/auth/RegisterForm.tsx` | Client form: email + fullName + password + confirm password |
| Create | `components/auth/EmailPasswordSignInForm.tsx` | Client form: email + password, shows lockout/invalid errors |
| Modify | `app/auth/login/page.tsx` | Add tabs: Google / Email+Password; show `?confirmed=1` banner |
| Create | `app/auth/register/page.tsx` | Register page server wrapper |
| Create | `test/unit/auth/register-route.test.ts` | Unit tests for register route (Supabase auth mocked) |
| Create | `test/unit/auth/confirm-route.test.ts` | Unit tests for confirm route (Supabase auth + DB mocked) |
| Create | `test/unit/auth/signin-route.test.ts` | Unit tests for signin route (Supabase auth + DB mocked) |
| Create | `test/integration/email-signup.test.ts` | Integration tests for createStaffUserFromEmailSignup (real DB) |
| Create | `test/e2e/email-signup.spec.ts` | Playwright E2E: register → confirm → sign in |

---

## Task 1: Add `createStaffUserFromEmailSignup` to `lib/db/staff.ts`

**Files:**
- Modify: `lib/db/staff.ts`

- [ ] **Step 1: Write the failing test**

Create `test/integration/email-signup.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { createStaffUserFromEmailSignup, getStaffUserByAuthId } from "@/lib/db/staff";
import { skipIfNoTestDb } from "./setup";

const EMAIL_AUTH_ID = "00000000-0000-0000-0000-bbbbbbbbbbbb";
const EMAIL = "emailsignup-test@example.com";

describe.skipIf(skipIfNoTestDb)("createStaffUserFromEmailSignup", () => {
  afterEach(async () => {
    await db.delete(schema.staffUsers).where(eq(schema.staffUsers.id, EMAIL_AUTH_ID));
  });

  it("inserts staff_users row with status active and null schoolId", async () => {
    await createStaffUserFromEmailSignup({
      authUserId: EMAIL_AUTH_ID,
      email: EMAIL,
      fullName: "Test User",
    });

    const row = await getStaffUserByAuthId(EMAIL_AUTH_ID);
    expect(row).not.toBeNull();
    expect(row?.status).toBe("active");
    expect(row?.role).toBe("editor");
    expect(row?.schoolId).toBeNull();
    expect(row?.email).toBe(EMAIL);
    expect(row?.fullName).toBe("Test User");
  });

  it("is idempotent — second call does not throw", async () => {
    await createStaffUserFromEmailSignup({
      authUserId: EMAIL_AUTH_ID,
      email: EMAIL,
      fullName: "Test User",
    });
    await expect(
      createStaffUserFromEmailSignup({
        authUserId: EMAIL_AUTH_ID,
        email: EMAIL,
        fullName: "Test User",
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test test/integration/email-signup.test.ts
```

Expected: FAIL — `createStaffUserFromEmailSignup is not a function`

- [ ] **Step 3: Add function to `lib/db/staff.ts`**

Add after the `createStaffUserFromInvite` function (after line 93):

```typescript
/**
 * Creates a staff_users row for a user who registered via email/password.
 * schoolId is null — an admin assigns the school later.
 * Called from /auth/confirm after Supabase verifies the signup OTP.
 * Idempotent: onConflictDoNothing prevents duplicate-key errors on retry.
 */
export async function createStaffUserFromEmailSignup(params: {
  authUserId: string;
  email: string;
  fullName: string;
}): Promise<void> {
  await db
    .insert(staffUsers)
    .values({
      id: params.authUserId,
      schoolId: null,
      email: params.email,
      fullName: params.fullName,
      role: "editor",
      status: "active",
    })
    .onConflictDoNothing();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test test/integration/email-signup.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/db/staff.ts test/integration/email-signup.test.ts
git commit -m "feat: add createStaffUserFromEmailSignup to lib/db/staff"
```

---

## Task 2: Update `middleware.ts` to allow confirm and register routes

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Write the failing test**

There's no dedicated middleware test file. We verify via static check. Add a note in `test/unit/smoke.test.ts` instead — but actually, the correct check is: run `pnpm tsc --noEmit` after the edit. Skip the dedicated test step; proceed to implement.

- [ ] **Step 2: Update `middleware.ts` PUBLIC_PATHS**

In `middleware.ts`, change the `PUBLIC_PATHS` array (lines 53–60):

```typescript
  const PUBLIC_PATHS = [
    "/auth/login",
    "/auth/callback",
    "/auth/confirm",
    "/auth/register",
    "/auth/pending",
    "/auth/deactivated",
    "/invite/",
    "/ical/",
  ];
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat: allow /auth/confirm and /auth/register as public paths in middleware"
```

---

## Task 3: Create `POST /api/v1/auth/register` route

**Files:**
- Create: `app/api/v1/auth/register/route.ts`
- Create: `test/unit/auth/register-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/auth/register-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const signUpMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signUp: signUpMock },
  }),
}));

import { POST } from "@/app/api/v1/auth/register/route";

describe("POST /api/v1/auth/register", () => {
  beforeEach(() => signUpMock.mockReset());

  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("returns 422 when email is missing", async () => {
    const res = await POST(makeRequest({ fullName: "Test", password: "password123" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("returns 422 when password is shorter than 8 chars", async () => {
    const res = await POST(makeRequest({ email: "a@b.com", fullName: "Test", password: "short" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when fullName is empty", async () => {
    const res = await POST(makeRequest({ email: "a@b.com", fullName: "", password: "password123" }));
    expect(res.status).toBe(422);
  });

  it("returns 200 with confirmation_sent on success", async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await POST(makeRequest({ email: "a@b.com", fullName: "Test User", password: "password123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("confirmation_sent");
    expect(signUpMock).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "password123",
      options: { data: { full_name: "Test User" } },
    });
  });

  it("returns 409 when Supabase reports user already registered", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });
    const res = await POST(makeRequest({ email: "exists@b.com", fullName: "Test", password: "password123" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("email_already_registered");
  });

  it("returns 500 on unexpected Supabase error", async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: { message: "unexpected" } });
    const res = await POST(makeRequest({ email: "a@b.com", fullName: "Test", password: "password123" }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test test/unit/auth/register-route.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the route**

Create `app/api/v1/auth/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RegisterSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { email, fullName, password } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return NextResponse.json({ error: "email_already_registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "signup_failed" }, { status: 500 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "signup_failed" }, { status: 500 });
  }

  return NextResponse.json({ status: "confirmation_sent" }, { status: 200 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test test/unit/auth/register-route.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/auth/register/route.ts test/unit/auth/register-route.test.ts
git commit -m "feat: add POST /api/v1/auth/register route with Zod validation"
```

---

## Task 4: Create `GET /auth/confirm` route

**Files:**
- Create: `app/auth/confirm/route.ts`
- Create: `test/unit/auth/confirm-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/auth/confirm-route.test.ts` (separate file so `vi.mock` hoisting works cleanly):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

const verifyOtpMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { verifyOtp: verifyOtpMock },
  }),
}));

const getStaffUserByAuthIdMock = vi.fn();
const createStaffUserFromEmailSignupMock = vi.fn();
vi.mock("@/lib/db/staff", () => ({
  getStaffUserByAuthId: (...args: unknown[]) => getStaffUserByAuthIdMock(...args),
  createStaffUserFromEmailSignup: (...args: unknown[]) => createStaffUserFromEmailSignupMock(...args),
}));

import { GET } from "@/app/auth/confirm/route";

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    getStaffUserByAuthIdMock.mockReset();
    createStaffUserFromEmailSignupMock.mockReset();
  });

  it("redirects to /auth/login?error=invalid_token when token_hash is missing", async () => {
    const req = new NextRequest("http://localhost/auth/confirm");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?error=invalid_token");
  });

  it("redirects to /auth/login?error=invalid_token when type is not signup", async () => {
    const req = new NextRequest("http://localhost/auth/confirm?token_hash=abc&type=recovery");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?error=invalid_token");
  });

  it("redirects to /auth/login?error=invalid_token when verifyOtp fails", async () => {
    verifyOtpMock.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    const req = new NextRequest("http://localhost/auth/confirm?token_hash=badhash&type=signup");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?error=invalid_token");
    expect(createStaffUserFromEmailSignupMock).not.toHaveBeenCalled();
  });

  it("calls createStaffUserFromEmailSignup and redirects to /auth/login?confirmed=1 on success", async () => {
    verifyOtpMock.mockResolvedValue({
      data: {
        user: { id: "u1", email: "test@example.com", user_metadata: { full_name: "Test User" } },
      },
      error: null,
    });
    getStaffUserByAuthIdMock.mockResolvedValue(null);
    createStaffUserFromEmailSignupMock.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/auth/confirm?token_hash=validhash&type=signup");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?confirmed=1");
    expect(createStaffUserFromEmailSignupMock).toHaveBeenCalledWith({
      authUserId: "u1",
      email: "test@example.com",
      fullName: "Test User",
    });
  });

  it("skips createStaffUserFromEmailSignup when staff_users row already exists (idempotent)", async () => {
    verifyOtpMock.mockResolvedValue({
      data: {
        user: { id: "u1", email: "test@example.com", user_metadata: { full_name: "Test User" } },
      },
      error: null,
    });
    getStaffUserByAuthIdMock.mockResolvedValue({ id: "u1", status: "active" });

    const req = new NextRequest("http://localhost/auth/confirm?token_hash=validhash&type=signup");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?confirmed=1");
    expect(createStaffUserFromEmailSignupMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test test/unit/auth/confirm-route.test.ts
```

Expected: FAIL — confirm route module not found

- [ ] **Step 3: Create the confirm route**

Create `app/auth/confirm/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStaffUserFromEmailSignup, getStaffUserByAuthId } from "@/lib/db/staff";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || type !== "signup") {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_token", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "signup",
  });

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_token", origin));
  }

  const authUser = data.user;
  const existing = await getStaffUserByAuthId(authUser.id);

  if (!existing) {
    const email = authUser.email ?? "";
    const fullName =
      String(authUser.user_metadata?.full_name ?? email).trim() || email;
    await createStaffUserFromEmailSignup({
      authUserId: authUser.id,
      email,
      fullName,
    });
  }

  return NextResponse.redirect(new URL("/auth/login?confirmed=1", origin));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test test/unit/auth/confirm-route.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/auth/confirm/route.ts test/unit/auth/confirm-route.test.ts
git commit -m "feat: add GET /auth/confirm route — verifies OTP and creates staff_users row"
```

---

## Task 5: Create `POST /api/v1/auth/signin` route

**Files:**
- Create: `app/api/v1/auth/signin/route.ts`
- Create: `test/unit/auth/signin-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/auth/signin-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const signInMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: signInMock },
  }),
}));

const getStaffMock = vi.fn();
vi.mock("@/lib/db/staff", () => ({
  getStaffUserByEmail: (...args: unknown[]) => getStaffMock(...args),
  incrementLoginAttempts: vi.fn(),
  resetLoginAttempts: vi.fn(),
}));

import { POST } from "@/app/api/v1/auth/signin/route";

describe("POST /api/v1/auth/signin", () => {
  beforeEach(() => {
    signInMock.mockReset();
    getStaffMock.mockReset();
  });

  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/v1/auth/signin", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("returns 422 when email is missing", async () => {
    const res = await POST(makeRequest({ password: "password123" }));
    expect(res.status).toBe(422);
  });

  it("returns 423 with lockedUntil when account is locked", async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    getStaffMock.mockResolvedValue({
      id: "u1",
      status: "active",
      loginAttempts: 10,
      lockedUntil,
    });

    const res = await POST(makeRequest({ email: "a@b.com", password: "password123" }));
    expect(res.status).toBe(423);
    const body = await res.json();
    expect(body.error).toBe("account_locked");
    expect(body.lockedUntil).toBe(lockedUntil);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("returns 401 and increments attempts on wrong password", async () => {
    getStaffMock.mockResolvedValue({
      id: "u1",
      status: "active",
      loginAttempts: 2,
      lockedUntil: null,
    });
    signInMock.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });

    const res = await POST(makeRequest({ email: "a@b.com", password: "wrongpass" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
    expect(body.attemptsRemaining).toBe(7); // 10 - (2+1)
  });

  it("returns 200 on successful sign in and resets attempts", async () => {
    getStaffMock.mockResolvedValue({
      id: "u1",
      status: "active",
      loginAttempts: 0,
      lockedUntil: null,
    });
    signInMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const res = await POST(makeRequest({ email: "a@b.com", password: "password123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.redirectTo).toBe("/dashboard");
  });

  it("returns 401 when staff_users row not found (no account)", async () => {
    getStaffMock.mockResolvedValue(null);
    signInMock.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });

    const res = await POST(makeRequest({ email: "ghost@b.com", password: "password123" }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test test/unit/auth/signin-route.test.ts
```

Expected: FAIL — modules not found

- [ ] **Step 3: Add `getStaffUserByEmail`, `incrementLoginAttempts`, `resetLoginAttempts` to `lib/db/staff.ts`**

Add these three functions to the end of `lib/db/staff.ts`:

```typescript
export async function getStaffUserByEmail(
  email: string,
): Promise<{ id: string; status: "pending" | "active" | "deactivated"; loginAttempts: number; lockedUntil: Date | null } | null> {
  const [row] = await db
    .select({
      id: staffUsers.id,
      status: staffUsers.status,
      loginAttempts: staffUsers.loginAttempts,
      lockedUntil: staffUsers.lockedUntil,
    })
    .from(staffUsers)
    .where(eq(staffUsers.email, email))
    .limit(1);
  return row ?? null;
}

export async function incrementLoginAttempts(
  staffUserId: string,
  currentAttempts: number,
): Promise<void> {
  const newAttempts = currentAttempts + 1;
  const lockedUntil =
    newAttempts >= 10 ? new Date(Date.now() + 15 * 60 * 1000) : null;

  await db
    .update(staffUsers)
    .set({
      loginAttempts: newAttempts,
      ...(lockedUntil ? { lockedUntil } : {}),
    })
    .where(eq(staffUsers.id, staffUserId));
}

export async function resetLoginAttempts(staffUserId: string): Promise<void> {
  await db
    .update(staffUsers)
    .set({ loginAttempts: 0, lockedUntil: null })
    .where(eq(staffUsers.id, staffUserId));
}
```

- [ ] **Step 4: Create the signin route**

Create `app/api/v1/auth/signin/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStaffUserByEmail,
  incrementLoginAttempts,
  resetLoginAttempts,
} from "@/lib/db/staff";

const MAX_ATTEMPTS = 10;

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { email, password } = parsed.data;

  const staffUser = await getStaffUserByEmail(email);

  if (staffUser?.lockedUntil && staffUser.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: "account_locked", lockedUntil: staffUser.lockedUntil.toISOString() },
      { status: 423 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (staffUser) {
      await incrementLoginAttempts(staffUser.id, staffUser.loginAttempts);
      const newAttempts = staffUser.loginAttempts + 1;
      const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts);
      return NextResponse.json(
        { error: "invalid_credentials", attemptsRemaining: remaining },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  if (staffUser) {
    await resetLoginAttempts(staffUser.id);
  }

  return NextResponse.json({ status: "ok", redirectTo: "/dashboard" }, { status: 200 });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test test/unit/auth/signin-route.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/v1/auth/signin/route.ts lib/db/staff.ts test/unit/auth/signin-route.test.ts
git commit -m "feat: add POST /api/v1/auth/signin with lockout enforcement"
```

---

## Task 6: Create `RegisterForm` component

**Files:**
- Create: `components/auth/RegisterForm.tsx`

- [ ] **Step 1: Create the component**

Create `components/auth/RegisterForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    if (password.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, fullName, password }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setError("כתובת האימייל כבר רשומה במערכת");
        return;
      }
      if (!res.ok) {
        setError("אירעה שגיאה. נסו שוב מאוחר יותר");
        return;
      }
      if (data.status === "confirmation_sent") {
        setSent(true);
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center py-4">
        <p className="font-medium">בדקו את תיבת הדואר שלכם</p>
        <p className="text-sm text-muted-foreground">
          שלחנו קישור אישור לכתובת <strong>{email}</strong>. לחצו על הקישור כדי להפעיל את החשבון.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="reg-fullName" className="text-sm font-medium">
          שם מלא
        </label>
        <input
          id="reg-fullName"
          type="text"
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="auto"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="reg-email" className="text-sm font-medium">
          אימייל
        </label>
        <input
          id="reg-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="reg-password" className="text-sm font-medium">
          סיסמה
        </label>
        <input
          id="reg-password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="reg-confirm" className="text-sm font-medium">
          אישור סיסמה
        </label>
        <input
          id="reg-confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "שולח..." : "הרשמה"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/auth/RegisterForm.tsx
git commit -m "feat: add RegisterForm client component"
```

---

## Task 7: Create `EmailPasswordSignInForm` component

**Files:**
- Create: `components/auth/EmailPasswordSignInForm.tsx`

- [ ] **Step 1: Create the component**

Create `components/auth/EmailPasswordSignInForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EmailPasswordSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.status === 423) {
        const until = data.lockedUntil
          ? new Date(data.lockedUntil).toLocaleTimeString("he-IL")
          : "";
        setError(`החשבון נעול זמנית. נסו שוב אחרי ${until}`);
        return;
      }
      if (res.status === 401) {
        const remaining = data.attemptsRemaining ?? "";
        setError(
          remaining
            ? `אימייל או סיסמה שגויים. נותרו ${remaining} ניסיונות`
            : "אימייל או סיסמה שגויים",
        );
        return;
      }
      if (!res.ok) {
        setError("אירעה שגיאה. נסו שוב מאוחר יותר");
        return;
      }

      router.push(data.redirectTo ?? "/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="signin-email" className="text-sm font-medium">
          אימייל
        </label>
        <input
          id="signin-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="signin-password" className="text-sm font-medium">
          סיסמה
        </label>
        <input
          id="signin-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "מתחבר..." : "כניסה"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/auth/EmailPasswordSignInForm.tsx
git commit -m "feat: add EmailPasswordSignInForm client component"
```

---

## Task 8: Create register page and update login page

**Files:**
- Create: `app/auth/register/page.tsx`
- Modify: `app/auth/login/page.tsx`

- [ ] **Step 1: Create `app/auth/register/page.tsx`**

```tsx
import { RegisterForm } from "@/components/auth/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">הרשמה למערכת</h1>
          <p className="text-muted-foreground text-sm">צרו חשבון חדש</p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          כבר יש לכם חשבון?{" "}
          <Link href="/auth/login" className="underline hover:text-foreground">
            כניסה
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/auth/login/page.tsx`**

Replace the entire file:

```tsx
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { EmailPasswordSignInForm } from "@/components/auth/EmailPasswordSignInForm";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; token?: string; confirmed?: string; error?: string }>;
}) {
  const { next, token, confirmed, error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">כניסה למערכת</h1>
        </div>

        {confirmed === "1" && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
            האימייל אושר בהצלחה. כעת ניתן להתחבר.
          </div>
        )}

        {error === "invalid_token" && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
            קישור האישור אינו תקף או פג תוקפו. נסו להירשם שוב.
          </div>
        )}

        <div className="space-y-4">
          <EmailPasswordSignInForm />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">או</span>
            </div>
          </div>

          <GoogleSignInButton next={next} token={token} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          עדיין אין לכם חשבון?{" "}
          <Link href="/auth/register" className="underline hover:text-foreground">
            הרשמה
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/auth/register/page.tsx app/auth/login/page.tsx
git commit -m "feat: add register page and update login page with email/password tab"
```

---

## Task 9: Run full test suite and fix any failures

- [ ] **Step 1: Run all unit + integration tests**

```bash
pnpm test
```

Expected: all existing tests pass; new tests pass

- [ ] **Step 2: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors

- [ ] **Step 4: Fix any failures**

If tests fail, investigate and fix. Common issues:
- Import paths wrong → check `@/` alias resolves to project root
- `vi.mock` hoisting issue → ensure mocks are declared before imports at top of test file
- `onConflictDoNothing` not imported → add `import { ... } from "drizzle-orm/pg-core"` — actually it's a method on the insert builder, no extra import needed

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address test suite failures after email/password registration feature"
```

---

## Task 10: Playwright E2E test (optional — requires Supabase dev instance)

**Files:**
- Create: `test/e2e/email-signup.spec.ts`

This test requires a live Supabase instance with email confirmations enabled and a real email delivery mechanism (or Supabase's inbucket local email). Skip in CI if `TEST_SUPABASE_EMAIL_SIGNUP` env var is not set.

- [ ] **Step 1: Create the E2E spec**

Create `test/e2e/email-signup.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

const SKIP = !process.env.TEST_SUPABASE_EMAIL_SIGNUP;

test.describe("Email/Password Registration Flow", () => {
  test.skip(SKIP, "Requires TEST_SUPABASE_EMAIL_SIGNUP env var");

  test("register page is accessible from login page", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: "כניסה למערכת" })).toBeVisible();
    await page.getByRole("link", { name: "הרשמה" }).click();
    await expect(page.getByRole("heading", { name: "הרשמה למערכת" })).toBeVisible();
  });

  test("register form shows check-email state after valid submission", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("שם מלא").fill("Test User");
    await page.getByLabel("אימייל").fill(`test-${Date.now()}@example.com`);
    await page.getByLabel("סיסמה", { exact: true }).fill("password123");
    await page.getByLabel("אישור סיסמה").fill("password123");
    await page.getByRole("button", { name: "הרשמה" }).click();
    await expect(page.getByText("בדקו את תיבת הדואר שלכם")).toBeVisible();
  });

  test("register form shows error for duplicate email", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("שם מלא").fill("Test User");
    await page.getByLabel("אימייל").fill("admin@school.test"); // seed user
    await page.getByLabel("סיסמה", { exact: true }).fill("password123");
    await page.getByLabel("אישור סיסמה").fill("password123");
    await page.getByRole("button", { name: "הרשמה" }).click();
    await expect(page.getByRole("alert")).toContainText("כבר רשומה");
  });

  test("login page shows confirmed banner after ?confirmed=1", async ({ page }) => {
    await page.goto("/auth/login?confirmed=1");
    await expect(page.getByText("האימייל אושר בהצלחה")).toBeVisible();
  });

  test("login page shows invalid token banner after ?error=invalid_token", async ({ page }) => {
    await page.goto("/auth/login?error=invalid_token");
    await expect(page.getByText("קישור האישור אינו תקף")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests (UI-only assertions only)**

```bash
pnpm playwright test test/e2e/email-signup.spec.ts
```

Expected: "register page is accessible", "confirmed banner", "invalid_token banner" pass. The "check-email" and "duplicate email" tests are skipped unless `TEST_SUPABASE_EMAIL_SIGNUP` is set.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/email-signup.spec.ts
git commit -m "test: add Playwright E2E spec for email/password registration UI"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `pnpm test` — all unit + integration tests pass
- [ ] `pnpm tsc --noEmit` — no type errors
- [ ] `pnpm lint` — no lint errors
- [ ] `pnpm build` — build succeeds
- [ ] Manual: visit `/auth/login` — email/password form visible alongside Google button
- [ ] Manual: visit `/auth/register` — registration form renders
- [ ] Manual: `/auth/login?confirmed=1` — green banner visible
- [ ] Manual: `/auth/login?error=invalid_token` — error banner visible
- [ ] Manual: `/auth/confirm` without params → redirects to `/auth/login?error=invalid_token`
