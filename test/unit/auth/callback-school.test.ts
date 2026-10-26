import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const exchangeMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: exchangeMock, signOut: vi.fn() },
  }),
}));

vi.mock("@/lib/db/staff", () => ({
  getStaffUserByAuthId: async () => null,
  createStaffUserFromInvite: vi.fn(),
}));
vi.mock("@/lib/db/invites", () => ({
  getInviteByToken: vi.fn(),
  markInviteUsed: vi.fn(),
  updateInviteUsedBy: vi.fn(),
}));

const createPendingMock = vi.fn();
vi.mock("@/lib/db/pending", () => ({
  createPendingRegistration: (...args: unknown[]) => createPendingMock(...args),
  getPendingRegistrationByAuthId: async () => null,
}));

const resolveMock = vi.fn();
vi.mock("@/lib/db/schools", () => ({
  resolveSchoolIdFromParam: (...args: unknown[]) => resolveMock(...args),
}));

import { GET } from "@/app/auth/callback/route";

function callback(query: string) {
  return GET(new NextRequest(`http://localhost/auth/callback?code=c${query}`));
}

describe("GET /auth/callback without an invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeMock.mockResolvedValue({
      data: { user: { id: "auth-1", email: "g@b.com", user_metadata: { full_name: "G" } } },
      error: null,
    });
  });

  it("creates the pending registration in the school from ?school=", async () => {
    resolveMock.mockResolvedValue("school-a-id");
    const res = await callback("&school=test-a");
    expect(resolveMock).toHaveBeenCalledWith("test-a");
    expect(createPendingMock).toHaveBeenCalledWith(
      expect.objectContaining({ authUserId: "auth-1", schoolId: "school-a-id" }),
    );
    expect(res.headers.get("location")).toContain("/auth/pending");
  });

  it("uses a null school when the slug does not resolve", async () => {
    resolveMock.mockResolvedValue(null);
    await callback("&school=no-such-school");
    expect(createPendingMock).toHaveBeenCalledWith(expect.objectContaining({ schoolId: null }));
  });
});
