import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createStaffUserFromInvite,
  getStaffUserByAuthId,
  getStaffUserByEmail,
  getStaffUserRecordByEmail,
  incrementLoginAttempts,
  resetLoginAttempts,
} from "@/lib/db/staff";
import { getInviteByToken } from "@/lib/db/invites";
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

  // Fall back to email-based lookup so users who authenticated via a different
  // Supabase identity (e.g. email/password vs Google OAuth) still reach the dashboard.
  let resolvedUser =
    authedStaffUser ??
    (data.user.email ? await getStaffUserRecordByEmail(data.user.email) : null);

  // If still no staff record, check for a pending invite in user_metadata.
  // This handles the case where /auth/confirm was hit by an email scanner
  // (consuming the OTP) before the user clicked the link, leaving them with a
  // confirmed auth account but no staff_users row.
  if (!resolvedUser) {
    const inviteToken = data.user.user_metadata?.invite_token as string | undefined;
    if (inviteToken) {
      try {
        const invite = await getInviteByToken(inviteToken);
        const isValid =
          invite &&
          invite.expiresAt > new Date() &&
          (invite.multiUse || !invite.usedAt);
        if (isValid) {
          await createStaffUserFromInvite({
            authUserId: data.user.id,
            schoolId: invite.schoolId,
            email: data.user.email ?? email,
            fullName: String(data.user.user_metadata?.full_name ?? email),
            role: invite.role,
            gradeScopes: invite.gradeScopes,
            eventTypeScopes: invite.eventTypeScopes,
          });
          resolvedUser = await getStaffUserByAuthId(data.user.id);
        }
      } catch {
        // Non-fatal: user lands on /auth/pending and an admin can assign them manually.
      }
    }
  }

  return NextResponse.json(
    { status: "ok", redirectTo: getPostLoginRedirect(resolvedUser) },
    { status: 200 },
  );
}
