import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffUserByAuthId } from "@/lib/db/staff";
// TODO: import from lib/db/pending and lib/db/invites (Tasks 8+9)

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
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

  // No staff_users row — pending registration creation handled in Task 8+9
  return NextResponse.redirect(new URL("/auth/pending", origin));
}
