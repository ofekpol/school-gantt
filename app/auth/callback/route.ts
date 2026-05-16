import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStaffUserFromInvite, getStaffUserByAuthId } from "@/lib/db/staff";
import { getInviteByToken, markInviteUsed } from "@/lib/db/invites";
import { createPendingRegistration, getPendingRegistrationByAuthId } from "@/lib/db/pending";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const inviteToken = searchParams.get("invite_token");
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  const authUser = data.user;
  const staffUser = await getStaffUserByAuthId(authUser.id);

  if (staffUser) {
    if (staffUser.status === "active") {
      return NextResponse.redirect(new URL(next, origin));
    }
    if (staffUser.status === "deactivated") {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/auth/deactivated", origin));
    }
    // status === "pending"
    return NextResponse.redirect(new URL("/auth/pending", origin));
  }

  const metadata = authUser.user_metadata ?? {};
  const email = authUser.email ?? "";
  const fullName =
    String(metadata.full_name ?? metadata.name ?? email).trim() || email;
  const googleAvatarUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  if (inviteToken) {
    const invite = await getInviteByToken(inviteToken);
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
      return NextResponse.redirect(new URL(`/invite/${inviteToken}?error=expired`, origin));
    }

    const created = await createStaffUserFromInvite({
      authUserId: authUser.id,
      schoolId: invite.schoolId,
      email,
      fullName,
      role: invite.role,
      gradeScopes: invite.gradeScopes,
      eventTypeScopes: invite.eventTypeScopes,
    });
    await markInviteUsed(inviteToken, created.id);
    return NextResponse.redirect(new URL(next, origin));
  }

  const pending = await getPendingRegistrationByAuthId(authUser.id);
  if (!pending) {
    await createPendingRegistration({
      authUserId: authUser.id,
      email,
      fullName,
      googleAvatarUrl,
    });
  }

  return NextResponse.redirect(new URL("/auth/pending", origin));
}
