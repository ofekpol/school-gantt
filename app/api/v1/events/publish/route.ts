import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { createPublishedEvent } from "@/lib/events/crud";
import { getActiveAcademicYear, getEditorAllowedGrades } from "@/lib/events/queries";
import { EventQuickPublishSchema } from "@/lib/validations/events";
import { invalidatePublicViewerCache } from "@/lib/views/public-viewer-data";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "viewer" || user.status !== "active" || user.mustChangePassword) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = EventQuickPublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const year = await getActiveAcademicYear(user.schoolId!);
  if (!year) {
    return NextResponse.json({ error: "no_active_year" }, { status: 409 });
  }

  if (user.role !== "admin") {
    const allowed = await getEditorAllowedGrades(user.schoolId!, user.id);
    const allowedSet = new Set(allowed);
    const violators = parsed.data.grades.filter((grade) => !allowedSet.has(grade));
    if (violators.length > 0) {
      return NextResponse.json(
        { error: "scope_violation", grades: violators },
        { status: 403 },
      );
    }
  }

  const event = await createPublishedEvent(user.schoolId!, user.id, parsed.data);
  invalidatePublicViewerCache(user.schoolSlug);
  return NextResponse.json(event, { status: 201 });
}
