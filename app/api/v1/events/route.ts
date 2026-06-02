import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffUser } from "@/lib/auth/session";
import { createDraft, updateDraft } from "@/lib/events/crud";
import { publishEvent } from "@/lib/events/approval";
import { EventDraftSchema } from "@/lib/validations/events";
import { getEditorAllowedGrades, getEditorDashboardEvents } from "@/lib/events/queries";

const CreateBodySchema = EventDraftSchema.extend({
  eventTypeId: z.string().uuid(),
  publish: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const events = await getEditorDashboardEvents(user.schoolId!, user.id);
  return NextResponse.json({ events }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "viewer" || user.status !== "active" || user.mustChangePassword) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { eventTypeId, publish, ...draftFields } = parsed.data;

  const draft = await createDraft(user.schoolId!, user.id, eventTypeId);

  const hasDraftFields = Object.keys(draftFields).length > 0;
  if (!hasDraftFields && !publish) {
    return NextResponse.json(draft, { status: 201 });
  }

  if (draftFields.grades && draftFields.grades.length > 0 && user.role !== "admin") {
    const allowed = await getEditorAllowedGrades(user.schoolId!, user.id);
    const allowedSet = new Set(allowed);
    const violators = draftFields.grades.filter((g) => !allowedSet.has(g));
    if (violators.length > 0) {
      return NextResponse.json(
        { error: "scope_violation", grades: violators },
        { status: 403 },
      );
    }
  }

  if (hasDraftFields) {
    const updated = await updateDraft(
      user.schoolId!,
      draft.id,
      user.id,
      user.role === "admin",
      draftFields,
      null,
    );
    if (updated.status !== "ok") {
      return NextResponse.json({ error: updated.status }, { status: 500 });
    }
  }

  if (publish) {
    try {
      await publishEvent(user.schoolId!, draft.id, user.id);
    } catch (e) {
      if (e instanceof Response) {
        return NextResponse.json(
          { error: e.statusText || "Error" },
          { status: e.status },
        );
      }
      throw e;
    }
    return NextResponse.json({ id: draft.id, status: "approved" }, { status: 201 });
  }

  return NextResponse.json(draft, { status: 201 });
}
