import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { autoApproveAsAdmin, submitForApproval } from "@/lib/events/approval";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    // PRD §6.3 — admin-created events bypass the queue and are auto-approved.
    if (user.role === "admin") {
      await autoApproveAsAdmin(user.schoolId, id, user.id);
      return NextResponse.json({ ok: true, status: "approved" }, { status: 200 });
    }
    await submitForApproval(user.schoolId, id, user.id);
    return NextResponse.json({ ok: true, status: "pending" }, { status: 200 });
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
