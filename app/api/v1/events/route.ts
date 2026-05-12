import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { createDraftEvent } from "@/lib/events/create";
import { eventDraftSchema } from "@/lib/validations/event";

/**
 * POST /api/v1/events
 * Creates a new draft event row. Returns { id, version }.
 * Requires authentication (returns 401 if not authenticated).
 */
export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = eventDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await createDraftEvent(user.schoolId, user.id, parsed.data);
  return NextResponse.json(result, { status: 201 });
}
