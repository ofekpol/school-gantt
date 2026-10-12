import { after, type NextRequest, NextResponse } from "next/server";
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

  const role = parsed.data.role;
  let result: Awaited<ReturnType<typeof approvePendingRegistration>>;
  try {
    // Always the admin's own school — never a client-supplied school id.
    result = await approvePendingRegistration({
      pendingId: parsed.data.pendingId,
      schoolId: user.schoolId,
      role,
      fullName: parsed.data.fullName,
      gradeScopes: parsed.data.gradeScopes,
      eventTypeScopes: parsed.data.eventTypeScopes,
      approvedBy: user.id,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "staff_user_in_other_school") {
      return NextResponse.json({ error: "Conflict" }, { status: 409 });
    }
    throw e;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  // Send approval email off the response critical path. DB commit already
  // happened; a slow/failing Resend call must not delay or fail the approval.
  after(async () => {
    try {
      await sendApprovalEmail({
        to: result.email,
        fullName: result.fullName,
        role,
        loginUrl: `${appUrl}/auth/login`,
      });
    } catch (err) {
      console.error("sendApprovalEmail failed", err);
    }
  });

  return NextResponse.json({ ok: true, staffUserId: result.staffUserId });
}
