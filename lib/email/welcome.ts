// NOTE: no `import "server-only"` — this helper is invoked by scripts/provision-school.ts
// via tsx outside the Next.js server runtime. Safe to import from server-only Next.js
// code; never import from a Client Component (Resend SDK requires the server).
import { Resend } from "resend";

export interface WelcomeEmailParams {
  to: string;
  adminName: string;
  schoolName: string;
  magicLinkUrl: string;
  expiresAt: Date;
  locale?: "he" | "en";
}

/**
 * Send a one-time welcome email to a newly provisioned school admin.
 * No-op when RESEND_API_KEY is absent (mirrors lib/email/invite.ts behavior).
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const expiresLocal = params.expiresAt.toISOString();

  const subject = `ברוכים הבאים ל-School Gantt — ${params.schoolName} / Welcome`;

  const body = [
    `שלום ${params.adminName},`,
    "",
    `נוצר עבורך חשבון מנהל עבור בית הספר "${params.schoolName}" במערכת School Gantt.`,
    "לחיצה על הקישור הבא תכניס אותך למערכת (תוקף הקישור: שעה אחת):",
    "",
    params.magicLinkUrl,
    "",
    `הקישור פג בתאריך: ${expiresLocal}`,
    "",
    "לאחר ההתחברות הראשונה, באפשרותך להזמין צוות נוסף דרך /admin/staff.",
    "",
    "—",
    "",
    `Hi ${params.adminName},`,
    "",
    `An admin account has been created for "${params.schoolName}" on School Gantt.`,
    "Click the link below to sign in (valid for 1 hour):",
    "",
    params.magicLinkUrl,
    "",
    `Expires: ${expiresLocal}`,
    "",
    "After your first sign-in, invite the rest of your staff at /admin/staff.",
  ].join("\n");

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "School Gantt <no-reply@example.com>",
    to: params.to,
    subject,
    text: body,
  });
}
