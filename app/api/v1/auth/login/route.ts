import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Test-only email/password login endpoint.
 * Only active when TEST_LOGIN_ENABLED=1 — returns 404 in all other environments.
 * Used by Playwright global setup (test/e2e/global.setup.ts) to create auth
 * state files without going through the Google OAuth flow.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.TEST_LOGIN_ENABLED !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password required" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
