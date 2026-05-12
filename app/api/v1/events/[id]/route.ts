import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { updateEventStep, softDeleteEvent } from "@/lib/events/create";
import { eventDraftSchema } from "@/lib/validations/event";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/events/:id
 * Updates event fields for the given wizard step (autosave).
 * Requires authentication.
 */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = eventDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await updateEventStep(id, user.schoolId, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

/**
 * DELETE /api/v1/events/:id
 * Soft-deletes a draft event (sets deleted_at).
 * Only allowed on draft-status events (WIZARD-08).
 */
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await softDeleteEvent(id, user.schoolId);
  return new Response(null, { status: 204 });
}
