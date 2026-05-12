import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { assertAdmin } from "@/lib/auth/admin";
import { createStaffUser, listStaffUsers } from "@/lib/db/staff";
import { StaffUserCreateSchema } from "@/lib/validations/admin";

export async function GET(): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }
  const staff = await listStaffUsers(user!.schoolId);
  return NextResponse.json({ staff }, { status: 200 });
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
  const parsed = StaffUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await createStaffUser({
      schoolId: user!.schoolId,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      temporaryPassword: parsed.data.temporaryPassword,
      gradeScopes: parsed.data.gradeScopes,
      eventTypeScopes: parsed.data.eventTypeScopes,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "duplicate_email" }, { status: 409 });
    }
    return NextResponse.json({ error: "create_failed", message: msg }, { status: 500 });
  }
}
