import "dotenv/config";
import { parseArgs } from "node:util";
import { provisionSchool } from "@/lib/db/provision";
import { sendWelcomeEmail } from "@/lib/email/welcome";

/**
 * CLI to provision a new school (tenant) + admin user.
 *
 * Usage:
 *   pnpm provision:school \
 *     --slug=kfar-galim \
 *     --name="כפר גלים" \
 *     --year-label=2026-2027 \
 *     --year-start=2026-09-01 \
 *     --year-end=2027-07-31 \
 *     --admin-email=admin@example.com \
 *     --admin-name="ישראל ישראלי"
 *
 * Optional:
 *   --locale=he|en        (default he)
 *   --timezone=...        (default Asia/Jerusalem)
 *   --skip-email          (do not call Resend; print magic link to stdout only)
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      slug: { type: "string" },
      name: { type: "string" },
      locale: { type: "string" },
      timezone: { type: "string" },
      "year-label": { type: "string" },
      "year-start": { type: "string" },
      "year-end": { type: "string" },
      "admin-email": { type: "string" },
      "admin-name": { type: "string" },
      "skip-email": { type: "boolean", default: false },
    },
    strict: true,
  });

  const required = [
    "slug",
    "name",
    "year-label",
    "year-start",
    "year-end",
    "admin-email",
    "admin-name",
  ] as const;
  const missing = required.filter((k) => !values[k]);
  if (missing.length > 0) {
    console.error(`Missing required flags: ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }

  const locale = values.locale === "en" ? "en" : "he";

  const result = await provisionSchool({
    slug: values.slug!,
    name: values.name!,
    locale,
    timezone: values.timezone ?? "Asia/Jerusalem",
    yearLabel: values["year-label"]!,
    yearStart: values["year-start"]!,
    yearEnd: values["year-end"]!,
    adminEmail: values["admin-email"]!,
    adminName: values["admin-name"]!,
  });

  if (!values["skip-email"]) {
    await sendWelcomeEmail({
      to: values["admin-email"]!,
      adminName: values["admin-name"]!,
      schoolName: values.name!,
      magicLinkUrl: result.magicLinkUrl,
      expiresAt: new Date(result.magicLinkExpiresAt),
      locale,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "(NEXT_PUBLIC_APP_URL unset)";
  console.log("");
  console.log("School provisioned successfully:");
  console.log(`  schoolId         = ${result.schoolId}`);
  console.log(`  academicYearId   = ${result.academicYearId}`);
  console.log(`  public URL       = ${appUrl}/${values.slug}`);
  console.log(`  admin email      = ${values["admin-email"]}`);
  console.log(`  admin authId     = ${result.adminAuthUserId}`);
  console.log(`  magic link       = ${result.magicLinkUrl}`);
  console.log(`  magic link until = ${result.magicLinkExpiresAt}`);
  console.log("");
  if (values["skip-email"]) {
    console.log("--skip-email set: deliver the magic link manually.");
  } else {
    console.log("Welcome email sent via Resend (no-op if RESEND_API_KEY unset).");
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
