import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ db: {}, supabaseAdmin: {}, withSchool: vi.fn() }));

import { assertSeedTargetAllowed } from "@/db/seed";

describe("assertSeedTargetAllowed", () => {
  it("allows localhost", () => {
    expect(() => assertSeedTargetAllowed("postgres://u:p@localhost:5432/db")).not.toThrow();
    expect(() => assertSeedTargetAllowed("postgres://u:p@127.0.0.1:5432/db")).not.toThrow();
  });

  it("allows the staging project", () => {
    expect(() =>
      assertSeedTargetAllowed(
        "postgres://postgres.wmapfuwpdyishfqtzwha:p@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
      ),
    ).not.toThrow();
  });

  it("refuses any other host", () => {
    expect(() =>
      assertSeedTargetAllowed("postgres://u:p@db.abcprodref.supabase.co:5432/postgres"),
    ).toThrow(/refusing to seed/);
  });

  it("refuses when unset", () => {
    expect(() => assertSeedTargetAllowed(undefined)).toThrow(/refusing to seed/);
  });
});
