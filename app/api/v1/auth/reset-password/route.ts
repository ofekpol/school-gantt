import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login/reset`;

  // Triggers Supabase Auth's password recovery flow.
  // Email is dispatched by Supabase using the SMTP provider configured in the dashboard
  // (Resend SMTP relay — configured at the Task 4.3 checkpoint).
  // We INTENTIONALLY do NOT branch on the response — return 200 even if email is unknown,
  // to avoid leaking which addresses are registered (enumeration defense).
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return NextResponse.json({ ok: true }, { status: 200 });
}
