import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { listAllSchools } from "@/lib/db/schools";
import { provisionSchool, type ProvisionSchoolResult } from "@/lib/db/provision";
import { ProvisionSchoolInput } from "@/lib/validations/school";
import { sendWelcomeEmail } from "@/lib/email/welcome";

async function denyUnlessPlatformAdmin(): Promise<NextResponse | null> {
  try {
    await requirePlatformAdmin();
    return null;
  } catch (e) {
    if (e instanceof Response) return NextResponse.json({ error: "Forbidden" }, { status: e.status });
    throw e;
  }
}

export async function GET(): Promise<NextResponse> {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  return NextResponse.json({ schools: await listAllSchools() }, { status: 200 });
}

/** False when Resend is unconfigured or fails; the caller then shows the link instead. */
async function trySendWelcome(input: ProvisionSchoolInput, result: ProvisionSchoolResult): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    await sendWelcomeEmail({
      to: input.adminEmail,
      adminName: input.adminName,
      schoolName: input.name,
      magicLinkUrl: result.magicLinkUrl,
      expiresAt: new Date(result.magicLinkExpiresAt),
      locale: input.locale,
    });
    return true;
  } catch (error) {
    console.error("[platform/schools] welcome email failed", error);
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;

  const parsed = ProvisionSchoolInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  let result: ProvisionSchoolResult;
  try {
    result = await provisionSchool(parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("already exists")) {
      return NextResponse.json({ error: "duplicate_slug" }, { status: 409 });
    }
    console.error("[platform/schools] provision failed", e);
    return NextResponse.json({ error: "provision_failed" }, { status: 500 });
  }

  const emailSent = await trySendWelcome(parsed.data, result);
  return NextResponse.json(
    {
      schoolId: result.schoolId,
      slug: parsed.data.slug,
      emailSent,
      // Only a platform admin sees this, and only when the email didn't go out.
      magicLinkUrl: emailSent ? null : result.magicLinkUrl,
    },
    { status: 201 },
  );
}
