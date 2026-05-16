import { type NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { getStaffUser } from "@/lib/auth/session";
import {
  approvePendingRegistration,
  listPendingRegistrations,
  rejectPendingRegistration,
} from "@/lib/db/pending";
import { sendApprovalEmail } from "@/lib/email/approval";
import { ApprovePendingSchema } from "@/lib/validations/admin";

export async function GET(): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }

  const pending = await listPendingRegistrations();
  return NextResponse.json({ pending });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  try {
    assertAdmin(user);
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }

  const parsed = ApprovePendingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    await rejectPendingRegistration({
      pendingId: parsed.data.pendingId,
      reviewedBy: user.id,
    });
    return NextResponse.json({ ok: true });
  }

  const result = await approvePendingRegistration({
    pendingId: parsed.data.pendingId,
    schoolId: parsed.data.schoolId ?? user.schoolId,
    role: parsed.data.role,
    fullName: parsed.data.fullName,
    gradeScopes: parsed.data.gradeScopes,
    eventTypeScopes: parsed.data.eventTypeScopes,
    approvedBy: user.id,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  await sendApprovalEmail({
    to: result.email,
    fullName: result.fullName,
    role: parsed.data.role,
    loginUrl: `${appUrl}/auth/login`,
  });

  return NextResponse.json({ ok: true, staffUserId: result.staffUserId });
}
