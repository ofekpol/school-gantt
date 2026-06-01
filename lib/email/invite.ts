import "server-only";
import { Resend } from "resend";

const DATE_FMT = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  dateStyle: "long",
  timeStyle: "short",
});

const ROLE_HE: Record<string, string> = {
  admin: "מנהל",
  editor: "עורך",
  viewer: "צופה",
};

export async function sendInviteEmail(params: {
  to: string;
  inviteUrl: string;
  role: "editor" | "admin" | "viewer";
  expiresAt: Date;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const expiryFormatted = DATE_FMT.format(params.expiresAt);
  const roleHe = ROLE_HE[params.role] ?? params.role;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "School Gantt <no-reply@example.com>",
    to: params.to,
    subject: "הוזמנת להצטרף למערכת גאנט בית הספר",
    text: [
      "שלום,",
      "",
      `הוזמנת להצטרף למערכת גאנט בית הספר בתפקיד ${roleHe}.`,
      `פתח את הקישור הבא כדי לקבל את ההזמנה (תוקף עד ${expiryFormatted}):`,
      params.inviteUrl,
      "",
      "---",
      "",
      "Hi,",
      "",
      `You've been invited to join School Gantt as a ${params.role}.`,
      `Open this link to accept the invite (expires ${expiryFormatted}):`,
      params.inviteUrl,
    ].join("\n"),
  });
}
