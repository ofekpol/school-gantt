import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { createPersonalCalendarSubscription } from "@/lib/ical/subscriptions";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.mustChangePassword) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await createPersonalCalendarSubscription(user);
  const url = new URL(`/ical/${result.token}`, request.nextUrl.origin);

  return NextResponse.json(
    { id: result.id, url: url.toString() },
    { status: 201 },
  );
}
