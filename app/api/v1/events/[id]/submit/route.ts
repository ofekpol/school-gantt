import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { submitEvent } from "@/lib/events/submit";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/events/:id/submit
 * Transitions a draft event to pending status.
 * Writes an event_revisions row (WIZARD-06, APPROVAL-07).
 * Requires authentication.
 */
export async function POST(_request: Request, { params }: Params) {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await submitEvent(id, user.schoolId, user.id);
    return NextResponse.json({ status: "pending" });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
