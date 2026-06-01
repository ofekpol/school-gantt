import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStaffUserFromEmailSignup, createStaffUserFromInvite, getStaffUserByAuthId } from "@/lib/db/staff";
import { getInviteByToken, markInviteUsed } from "@/lib/db/invites";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || type !== "signup") {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_token", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "signup",
  });

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_token", origin));
  }

  const authUser = data.user;
  const existing = await getStaffUserByAuthId(authUser.id);
  if (existing) {
    return NextResponse.redirect(new URL("/auth/login?confirmed=1", origin));
  }

  const email = authUser.email ?? "";
  const fullName = String(authUser.user_metadata?.full_name ?? email).trim() || email;
  const inviteToken = authUser.user_metadata?.invite_token as string | undefined;

  if (inviteToken) {
    const invite = await getInviteByToken(inviteToken);
    const isValid =
      invite &&
      invite.expiresAt > new Date() &&
      (invite.multiUse || !invite.usedAt);

    if (isValid) {
      const staffUser = await createStaffUserFromInvite({
        authUserId: authUser.id,
        schoolId: invite.schoolId,
        email,
        fullName,
        role: invite.role,
        gradeScopes: invite.gradeScopes,
        eventTypeScopes: invite.eventTypeScopes,
      });
      await markInviteUsed(inviteToken, staffUser.id, invite.multiUse);
      return NextResponse.redirect(new URL("/dashboard", origin));
    }
  }

  await createStaffUserFromEmailSignup({ authUserId: authUser.id, email, fullName });
  return NextResponse.redirect(new URL("/auth/login?confirmed=1", origin));
}
