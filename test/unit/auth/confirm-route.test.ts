import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
