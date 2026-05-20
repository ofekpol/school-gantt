import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { publishEvent } from "@/lib/events/approval";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    if (user.role === "viewer" || user.status !== "active" || user.mustChangePassword) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // All active staff publish directly — no admin-queue step.
    await publishEvent(user.schoolId!, id, user.id);
    return NextResponse.json({ ok: true, status: "approved" }, { status: 200 });
  } catch (e) {
    if (e instanceof Response) {
      return NextResponse.json(
        { error: e.statusText || "Error" },
        { status: e.status },
      );
    }
    throw e;
  }
}
