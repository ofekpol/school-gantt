import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStaffUserByAuthId,
  getStaffUserByEmail,
  incrementLoginAttempts,
  resetLoginAttempts,
} from "@/lib/db/staff";
import { getPostLoginRedirect } from "@/lib/auth/redirects";

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

  if (staffUser?.lockedUntil && new Date(staffUser.lockedUntil) > new Date()) {
    return NextResponse.json(
      {
        error: "account_locked",
        lockedUntil:
          staffUser.lockedUntil instanceof Date
            ? staffUser.lockedUntil.toISOString()
            : staffUser.lockedUntil,
      },
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

  const authedStaffUser = await getStaffUserByAuthId(data.user.id);

  if (authedStaffUser) {
    await resetLoginAttempts(authedStaffUser.id);
  } else if (staffUser) {
    await resetLoginAttempts(staffUser.id);
  }

  return NextResponse.json(
    { status: "ok", redirectTo: getPostLoginRedirect(authedStaffUser) },
    { status: 200 },
  );
}
