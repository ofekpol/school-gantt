import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { assertAdmin } from "@/lib/auth/admin";
import { updateAcademicYear } from "@/lib/admin/years";
import { AcademicYearSchema } from "@/lib/validations/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = AcademicYearSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await updateAcademicYear(user!.schoolId, id, parsed.data);
  if (!result.updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ updated: true }, { status: 200 });
}
