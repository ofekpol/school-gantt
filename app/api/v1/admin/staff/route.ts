import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { assertAdmin } from "@/lib/auth/admin";
import { listStaffUsers } from "@/lib/db/staff";

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
  await request.text().catch(() => "");
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ error: "direct_staff_creation_removed" }, { status: 405 });
}
