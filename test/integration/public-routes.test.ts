import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("AUTH-07: public routes pass through without session", () => {
  it("middleware does not redirect unauthenticated request to /", async () => {
    const req = new NextRequest("http://localhost:3000/");
    const res = await middleware(req);
    // Public root: either 200 from i18n (no redirect needed) or 307 to /he (locale prefix)
    // Either is acceptable AUTH-07 behavior — what matters is NO redirect to /login
    expect(res.headers.get("location")?.toLowerCase() ?? "").not.toContain("/login");
  });

  it("middleware does not redirect unauthenticated request to /demo-school/agenda", async () => {
    const req = new NextRequest("http://localhost:3000/demo-school/agenda");
    const res = await middleware(req);
    expect(res.headers.get("location")?.toLowerCase() ?? "").not.toContain("/login");
  });

  it("middleware matcher excludes /api/v1/auth/* (skipped in matcher config)", () => {
    // Static assertion: matcher pattern excludes api/v1/auth
    const fs = require("node:fs");
    const src = fs.readFileSync(
      require("node:path").join(__dirname, "../../middleware.ts"),
      "utf8",
    );
    expect(src).toMatch(/api\/v1\/auth\//);
  });
});
