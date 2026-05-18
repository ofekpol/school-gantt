import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const signInMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: signInMock },
  }),
}));

const getStaffMock = vi.fn();
const incrementLoginAttemptsMock = vi.fn();
const resetLoginAttemptsMock = vi.fn();
vi.mock("@/lib/db/staff", () => ({
  getStaffUserByEmail: (...args: unknown[]) => getStaffMock(...args),
  incrementLoginAttempts: (...args: unknown[]) => incrementLoginAttemptsMock(...args),
  resetLoginAttempts: (...args: unknown[]) => resetLoginAttemptsMock(...args),
}));

import { POST } from "@/app/api/v1/auth/signin/route";

describe("POST /api/v1/auth/signin", () => {
  beforeEach(() => {
    signInMock.mockReset();
    getStaffMock.mockReset();
    incrementLoginAttemptsMock.mockReset();
    resetLoginAttemptsMock.mockReset();
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
