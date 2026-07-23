import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock @supabase/ssr so the middleware can be exercised without a real
// Supabase project (no network calls, no secrets in CI). We always return
// `user: null` so we exercise the unauthenticated path — that's what AUTH-07
// is about: public routes that should pass through *without* a session.
const getUserMock = vi.fn(async () => ({ data: { user: null }, error: null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

beforeAll(() => {
  // The middleware short-circuits with `return response` when these are unset.
  // Stub them so the auth-gate code actually runs and our mocked Supabase
  // client receives the call.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://stub.supabase.local";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "stub-anon-key";
});

// Dynamic import after the mock + env stubs are in place so middleware.ts
// resolves @supabase/ssr to our mock.
const importMiddleware = async () =>
  (await import("@/middleware")).middleware;

describe("AUTH-07: public routes pass through without session", () => {
  it("lets the root loading boundary stream without a duplicate middleware auth call", async () => {
    getUserMock.mockClear();
    const middleware = await importMiddleware();
    const res = await middleware(new NextRequest("http://localhost:3000/"));

    expect(res.headers.get("location")).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("does not redirect /auth/login (allowlisted)", async () => {
    const middleware = await importMiddleware();
    const res = await middleware(new NextRequest("http://localhost:3000/auth/login"));
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not redirect /invite/<token> (allowlisted)", async () => {
    const middleware = await importMiddleware();
    const res = await middleware(new NextRequest("http://localhost:3000/invite/abc123"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not redirect /ical/<token> (allowlisted)", async () => {
    const middleware = await importMiddleware();
    const res = await middleware(new NextRequest("http://localhost:3000/ical/sometoken.ics"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not redirect personal iCal subscription API so it can return 401", async () => {
    const middleware = await importMiddleware();
    const res = await middleware(
      new NextRequest("http://localhost:3000/api/v1/ical-subscriptions/personal"),
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects unauthenticated request to a protected route", async () => {
    const middleware = await importMiddleware();
    const res = await middleware(new NextRequest("http://localhost:3000/dashboard"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/login");
    expect(location).toContain("next=%2Fdashboard");
  });
});

describe("AUTH-07: public-path allowlist (static guard)", () => {
  it("public request helper whitelists auth, invite, and iCal routes", async () => {
    // Regressions that remove these would force-redirect public traffic
    // (login pages, invite acceptance, unauthenticated iCal feeds) to /auth/login.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(__dirname, "../../lib/auth/public-request.ts"),
      "utf8",
    );
    for (const route of [
      '"/auth/login"',
      '"/auth/callback"',
      '"/invite/"',
      '"/ical/"',
      '"/api/v1/ical-subscriptions/personal"',
    ]) {
      expect(src).toContain(route);
    }
  });
});
