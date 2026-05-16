import { type NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { getStaffUser } from "@/lib/auth/session";
import { createInvite, listInvitesForSchool } from "@/lib/db/invites";
import { StaffInviteCreateSchema } from "@/lib/validations/admin";

export async function GET(): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }

  const invites = await listInvitesForSchool(user.schoolId);
  return NextResponse.json({ invites });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }

  const parsed = StaffInviteCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createInvite({
    schoolId: user.schoolId,
    role: parsed.data.role,
    gradeScopes: parsed.data.gradeScopes ?? [],
    eventTypeScopes: parsed.data.eventTypeScopes ?? [],
    expiresInHours: parsed.data.expiresInHours,
    createdBy: user.id,
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const url = `${appUrl}/invite/${result.token}`;
  return NextResponse.json({ token: result.token, url }, { status: 201 });
}
