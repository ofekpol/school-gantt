import "dotenv/config";
import { parseArgs } from "node:util";
import {
  provisionSchool,
  type ProvisionSchoolInput,
  type ProvisionSchoolResult,
} from "@/lib/db/provision";
import { sendWelcomeEmail } from "@/lib/email/welcome";

/**
 * CLI to provision a new school (tenant) + admin user.
 *
 * Usage:
 *   pnpm provision:school \
 *     --slug=kfar-galim \
 *     --name="כפר גלים" \
 *     --admin-email=admin@example.com \
 *     --admin-name="ישראל ישראלי"
 *
 * Optional:
 *   --locale=he|en        (default he)
 *   --timezone=...        (default Asia/Jerusalem)
 *   --skip-email          (do not call Resend; print magic link to stdout only)
 */

const REQUIRED_FLAGS = [
  "slug",
  "name",
  "admin-email",
  "admin-name",
] as const;

interface ParsedFlags {
  input: ProvisionSchoolInput;
  skipEmail: boolean;
}

function parseFlags(): ParsedFlags {
  const { values } = parseArgs({
    options: {
      slug: { type: "string" },
      name: { type: "string" },
      locale: { type: "string" },
      timezone: { type: "string" },
      "admin-email": { type: "string" },
      "admin-name": { type: "string" },
      "skip-email": { type: "boolean", default: false },
    },
    strict: true,
  });

  const missing = REQUIRED_FLAGS.filter((k) => !values[k]);
  if (missing.length > 0) {
    console.error(`Missing required flags: ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }

  const locale = values.locale === "en" ? "en" : "he";
  return {
    input: {
      slug: values.slug!,
      name: values.name!,
      locale,
      timezone: values.timezone ?? "Asia/Jerusalem",
      adminEmail: values["admin-email"]!,
      adminName: values["admin-name"]!,
    },
    skipEmail: values["skip-email"] === true,
  };
}

async function maybeSendWelcome(
  flags: ParsedFlags,
  result: ProvisionSchoolResult,
): Promise<void> {
  if (flags.skipEmail) return;
  await sendWelcomeEmail({
    to: flags.input.adminEmail,
    adminName: flags.input.adminName,
    schoolName: flags.input.name,
    magicLinkUrl: result.magicLinkUrl,
    expiresAt: new Date(result.magicLinkExpiresAt),
    locale: flags.input.locale,
  });
}

function reportResult(flags: ParsedFlags, result: ProvisionSchoolResult): void {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "(NEXT_PUBLIC_APP_URL unset)";
  console.log("");
  console.log("School provisioned successfully:");
  console.log(`  schoolId         = ${result.schoolId}`);
  console.log(`  public URL       = ${appUrl}/${flags.input.slug}`);
  console.log(`  admin email      = ${flags.input.adminEmail}`);
  console.log(`  admin authId     = ${result.adminAuthUserId}`);
  console.log(`  magic link       = ${result.magicLinkUrl}`);
  console.log(`  magic link until = ${result.magicLinkExpiresAt}`);
  console.log("");
  console.log(
    flags.skipEmail
      ? "--skip-email set: deliver the magic link manually."
      : "Welcome email sent via Resend (no-op if RESEND_API_KEY unset).",
  );
}

async function main(): Promise<void> {
  const flags = parseFlags();
  const result = await provisionSchool(flags.input);
  await maybeSendWelcome(flags, result);
  reportResult(flags, result);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
