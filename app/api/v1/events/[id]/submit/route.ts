import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { publishEvent } from "@/lib/events/approval";
import { updateDraft } from "@/lib/events/crud";
import { EventDraftSchema } from "@/lib/validations/events";
import { getEditorAllowedGrades } from "@/lib/events/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    if (user.role === "viewer" || user.status !== "active" || user.mustChangePassword) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawBody = await request.text();
    if (rawBody.length > 0) {
      const parsed = EventDraftSchema.safeParse(JSON.parse(rawBody));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 },
        );
      }
      const draftFields = parsed.data;
      if (Object.keys(draftFields).length > 0) {
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
        const updated = await updateDraft(
          user.schoolId!,
          id,
          user.id,
          user.role === "admin",
          draftFields,
          null,
        );
        if (updated.status === "not_found") {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (updated.status === "conflict") {
          return NextResponse.json({ error: "version_conflict" }, { status: 409 });
        }
      }
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
