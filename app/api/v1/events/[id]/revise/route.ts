import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { editApprovedEvent } from "@/lib/events/approval";
import {
  getEditorAllowedGrades,
  getEventForEditor,
} from "@/lib/events/queries";
import { EventDraftSchema } from "@/lib/validations/events";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Creates a pending revision of an approved event (PRD §6.3:
 * "Edits to an approved event re-enter the approval queue; the previously
 * approved version remains the public version until the new version is
 * approved or rejected.")
 *
 * Returns the id of the new pending row so the client can redirect the
 * editor into the wizard at /events/new?resumeId=<new-id>.
 *
 * Auth: editor must own the original event OR be admin.
 * Scope: each grade in body.grades must be within the editor's scope
 * (same rule as PATCH /events/[id]).
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "viewer" || user.status !== "active") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const original = await getEventForEditor(
    user.schoolId,
    id,
    user.id,
    user.role === "admin",
  );
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (original.event.status !== "approved") {
    return NextResponse.json(
      { error: "Only approved events can be revised" },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = EventDraftSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.grades && parsed.data.grades.length > 0 && user.role !== "admin") {
    const allowed = await getEditorAllowedGrades(user.schoolId, user.id);
    const allowedSet = new Set(allowed);
    const violators = parsed.data.grades.filter((g) => !allowedSet.has(g));
    if (violators.length > 0) {
      return NextResponse.json(
        { error: "scope_violation", grades: violators },
        { status: 403 },
      );
    }
  }

  try {
    const result = await editApprovedEvent(user.schoolId, id, user.id, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : undefined,
      allDay: parsed.data.allDay,
      eventTypeId: parsed.data.eventTypeId,
      grades: parsed.data.grades,
    });
    return NextResponse.json({ id: result.id }, { status: 201 });
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
