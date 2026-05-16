import "server-only";
import { Resend } from "resend";

export async function sendApprovalEmail(params: {
  to: string;
  fullName: string;
  role: "editor" | "admin" | "viewer";
  loginUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "School Gantt <no-reply@example.com>",
    to: params.to,
    subject: "Your School Gantt access was approved",
    text: [
      `Hi ${params.fullName},`,
      "",
      `Your account was approved with the ${params.role} role.`,
      `Sign in here: ${params.loginUrl}`,
    ].join("\n"),
  });
}
