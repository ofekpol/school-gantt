import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffUser } from "@/lib/auth/session";
import { createDraft } from "@/lib/events/crud";
import {
  getActiveAcademicYear,
  getEditorDashboardEvents,
} from "@/lib/events/queries";

const CreateBodySchema = z.object({
  eventTypeId: z.string().uuid(),
});

export async function GET(): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const events = await getEditorDashboardEvents(user.schoolId, user.id);
  return NextResponse.json({ events }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "viewer" || user.status !== "active") {
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

  // Guard: cannot create event without an active academic year (RESEARCH Pitfall 2)
  const year = await getActiveAcademicYear(user.schoolId);
  if (!year) {
    return NextResponse.json({ error: "no_active_year" }, { status: 409 });
  }

  const draft = await createDraft(
    user.schoolId,
    user.id,
    parsed.data.eventTypeId,
  );
  return NextResponse.json(draft, { status: 201 });
}
