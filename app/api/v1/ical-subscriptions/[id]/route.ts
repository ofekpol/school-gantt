import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { revokeSubscription } from "@/lib/ical/subscriptions";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await revokeSubscription(user.schoolId, user.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ revoked: true }, { status: 200 });
}
