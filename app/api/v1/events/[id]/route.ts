import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { EventDraftSchema } from "@/lib/validations/events";
import { updateDraft, softDelete } from "@/lib/events/crud";
import {
  getEditorAllowedGrades,
  getEventForEditor,
} from "@/lib/events/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await getEventForEditor(
    user.schoolId,
    id,
    user.id,
    user.role === "admin",
  );
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const ifMatch = request.headers.get("If-Match");
  const expectedVersion = ifMatch !== null ? Number(ifMatch) : null;
  if (
    ifMatch !== null &&
    (isNaN(expectedVersion!) || !Number.isInteger(expectedVersion) || expectedVersion! < 1)
  ) {
    return NextResponse.json({ error: "Invalid If-Match" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = EventDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Scope check: every grade in body.grades must be in the editor's allowed set (WIZARD-05)
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

  const result = await updateDraft(
    user.schoolId,
    id,
    user.id,
    user.role === "admin",
    parsed.data,
    expectedVersion,
  );

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result.status === "conflict") {
    return NextResponse.json({ error: "version_conflict" }, { status: 409 });
  }
  if (result.status === "invalid_state") {
    return NextResponse.json(
      { error: "invalid_state", hint: "Use POST /revise for approved events" },
      { status: 409 },
    );
  }
  return NextResponse.json({ version: result.version }, { status: 200 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await softDelete(user.schoolId, id, user.id);
  if (!result.deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true }, { status: 200 });
}
