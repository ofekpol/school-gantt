import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { assertAdmin } from "@/lib/auth/admin";
import { createAcademicYear, listAcademicYears } from "@/lib/admin/years";
import { AcademicYearSchema } from "@/lib/validations/admin";

export async function GET(): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }
  const years = await listAcademicYears(user!.schoolId);
  return NextResponse.json({ years }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }
  const body = await request.json().catch(() => null);
  const parsed = AcademicYearSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await createAcademicYear(user!.schoolId, parsed.data);
  return NextResponse.json(result, { status: 201 });
}
