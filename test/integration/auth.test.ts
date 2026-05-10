import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { skipIfNoTestDb, testDb } from "./setup";
import { staffUsers } from "@/lib/db/schema";

const ADMIN_EMAIL = "admin@demo-school.test";
const ADMIN_PASSWORD = "ChangeMe123!";

// Mock next/headers so route handlers can be imported in Node env (not a Next.js server).
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// Mock @/lib/supabase/server to intercept Supabase auth calls.
// DB operations (loginAttempts, lockedUntil) still run against the real test database.
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Import after mocks are set up.
const { POST: loginPOST } = await import("@/app/api/v1/auth/login/route");
const { createSupabaseServerClient } = await import("@/lib/supabase/server");

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSupabaseMock(authSuccess: boolean): SupabaseClient {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(
        authSuccess
          ? { data: { user: { id: "mock-id" }, session: {} }, error: null }
          : { data: { user: null, session: null }, error: { message: "Invalid credentials" } },
      ),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  } as unknown as SupabaseClient;
}

describe.skipIf(skipIfNoTestDb)("AUTH-01: login with email + password", () => {
  beforeAll(async () => {
    // Seed must have been applied to TEST_DATABASE_URL before running these tests.
    await testDb!
      .update(staffUsers)
      .set({ loginAttempts: 0, lockedUntil: null })
      .where(eq(staffUsers.email, ADMIN_EMAIL));
  });

  beforeEach(async () => {
    // Reset lockout state for the admin before each test.
    await testDb!
      .update(staffUsers)
      .set({ loginAttempts: 0, lockedUntil: null })
      .where(eq(staffUsers.email, ADMIN_EMAIL));
  });

  it("valid credentials return 200 + user payload", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeSupabaseMock(true));
    const res = await loginPOST(makeReq({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(ADMIN_EMAIL);
  });

  it("wrong password returns 401", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeSupabaseMock(false));
    const res = await loginPOST(makeReq({ email: ADMIN_EMAIL, password: "wrong-pw" }));
    expect(res.status).toBe(401);
  });

  it("unknown email returns 401 (no leak)", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeSupabaseMock(false));
    const res = await loginPOST(makeReq({ email: "nobody@nowhere.test", password: "x" }));
    expect(res.status).toBe(401);
  });

  it("invalid input shape returns 400", async () => {
    const res = await loginPOST(makeReq({ email: "not-an-email", password: "" }));
    expect(res.status).toBe(400);
  });
});

describe.skipIf(skipIfNoTestDb)("AUTH-03: lockout after 10 failed attempts", () => {
  beforeEach(async () => {
    await testDb!
      .update(staffUsers)
      .set({ loginAttempts: 0, lockedUntil: null })
      .where(eq(staffUsers.email, ADMIN_EMAIL));
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeSupabaseMock(false));
  });

  it("10 failed attempts set locked_until in the future", async () => {
    for (let i = 0; i < 10; i++) {
      await loginPOST(makeReq({ email: ADMIN_EMAIL, password: "wrong" }));
    }
    const [row] = await testDb!
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.email, ADMIN_EMAIL));
    expect(row.loginAttempts).toBeGreaterThanOrEqual(10);
    expect(row.lockedUntil).toBeTruthy();
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("11th attempt with CORRECT password returns 423 Locked", async () => {
    for (let i = 0; i < 10; i++) {
      await loginPOST(makeReq({ email: ADMIN_EMAIL, password: "wrong" }));
    }
    // Switch to success auth — but lockout should still block
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeSupabaseMock(true));
    const res = await loginPOST(makeReq({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));
    expect(res.status).toBe(423);
  });

  it("successful login resets login_attempts to 0", async () => {
    // Fail twice (under threshold)
    await loginPOST(makeReq({ email: ADMIN_EMAIL, password: "wrong" }));
    await loginPOST(makeReq({ email: ADMIN_EMAIL, password: "wrong" }));

    // Switch to success auth
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeSupabaseMock(true));
    const res = await loginPOST(makeReq({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));
    expect(res.status).toBe(200);
    const [row] = await testDb!
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.email, ADMIN_EMAIL));
    expect(row.loginAttempts).toBe(0);
    expect(row.lockedUntil).toBeNull();
  });
});
