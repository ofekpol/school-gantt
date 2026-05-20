import "server-only";
import { Resend } from "resend";

export async function sendInviteEmail(params: {
  to: string;
  inviteUrl: string;
  role: "editor" | "admin" | "viewer";
  expiresAt: Date;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "School Gantt <no-reply@example.com>",
    to: params.to,
    subject: "You've been invited to School Gantt",
    text: [
      "Hi,",
      "",
      `You've been invited to join School Gantt as a ${params.role}.`,
      `Open this link to accept the invite (expires ${params.expiresAt.toISOString()}):`,
      params.inviteUrl,
    ].join("\n"),
  });
}
