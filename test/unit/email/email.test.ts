import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.hoisted lifts sendMock above the module boundary so it is available inside
// the vi.mock factory (which is hoisted to the top of the transformed file).

const sendMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {}, error: null }));

vi.mock("resend", () => ({
  // Use a class so `new Resend(apiKey)` works without "is not a constructor" errors.
  Resend: class {
    emails = { send: sendMock };
  },
}));

// ─── SUT ─────────────────────────────────────────────────────────────────────

import { sendInviteEmail } from "@/lib/email/invite";
import { sendApprovalEmail } from "@/lib/email/approval";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const EXPIRES_AT = new Date("2026-12-31T23:59:59.000Z");

beforeEach(() => {
  sendMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─────────────────────────────────────────────────────────────────────────────
// sendInviteEmail
// ─────────────────────────────────────────────────────────────────────────────

describe("sendInviteEmail: sends invite or no-ops when key absent", () => {
  it("returns without sending when RESEND_API_KEY is not set", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await sendInviteEmail({
      to: "user@example.com",
      inviteUrl: "https://app.example.com/invite/tok",
      role: "editor",
      expiresAt: EXPIRES_AT,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("calls resend.emails.send when RESEND_API_KEY is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendInviteEmail({
      to: "user@example.com",
      inviteUrl: "https://app.example.com/invite/tok",
      role: "editor",
      expiresAt: EXPIRES_AT,
    });
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("sends to the correct recipient", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendInviteEmail({
      to: "invitee@school.edu",
      inviteUrl: "https://app.example.com/invite/tok",
      role: "admin",
      expiresAt: EXPIRES_AT,
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.to).toBe("invitee@school.edu");
  });

  it("uses the correct subject line", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendInviteEmail({
      to: "user@example.com",
      inviteUrl: "https://app.example.com/invite/tok",
      role: "editor",
      expiresAt: EXPIRES_AT,
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.subject).toBe("You've been invited to School Gantt");
  });

  it("email text contains the invite URL", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const inviteUrl = "https://app.example.com/invite/abc123";
    await sendInviteEmail({ to: "u@e.com", inviteUrl, role: "viewer", expiresAt: EXPIRES_AT });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.text).toContain(inviteUrl);
  });

  it("email text contains the recipient's role", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendInviteEmail({
      to: "u@e.com",
      inviteUrl: "https://app.example.com/invite/tok",
      role: "admin",
      expiresAt: EXPIRES_AT,
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.text).toContain("admin");
  });

  it("email text contains the expiry date", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendInviteEmail({
      to: "u@e.com",
      inviteUrl: "https://app.example.com/invite/tok",
      role: "editor",
      expiresAt: EXPIRES_AT,
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.text).toContain(EXPIRES_AT.toISOString());
  });

  it("falls back to the default from address when RESEND_FROM_EMAIL is not set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    // Do NOT stub RESEND_FROM_EMAIL — leave it undefined so ?? triggers the fallback
    delete process.env.RESEND_FROM_EMAIL;
    await sendInviteEmail({
      to: "u@e.com",
      inviteUrl: "https://app.example.com/invite/tok",
      role: "editor",
      expiresAt: EXPIRES_AT,
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.from).toContain("no-reply@example.com");
  });

  it("uses RESEND_FROM_EMAIL when set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "Gantt <gantt@myschool.edu>");
    await sendInviteEmail({
      to: "u@e.com",
      inviteUrl: "https://app.example.com/invite/tok",
      role: "editor",
      expiresAt: EXPIRES_AT,
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.from).toBe("Gantt <gantt@myschool.edu>");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sendApprovalEmail
// ─────────────────────────────────────────────────────────────────────────────

describe("sendApprovalEmail: sends approval notification or no-ops when key absent", () => {
  it("returns without sending when RESEND_API_KEY is not set", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await sendApprovalEmail({
      to: "user@example.com",
      fullName: "Dana Cohen",
      role: "editor",
      loginUrl: "https://app.example.com/auth/login",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("calls resend.emails.send when RESEND_API_KEY is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendApprovalEmail({
      to: "user@example.com",
      fullName: "Dana Cohen",
      role: "editor",
      loginUrl: "https://app.example.com/auth/login",
    });
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("sends to the correct recipient", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendApprovalEmail({
      to: "dana@school.edu",
      fullName: "Dana",
      role: "admin",
      loginUrl: "https://app.example.com/auth/login",
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.to).toBe("dana@school.edu");
  });

  it("uses the correct subject line", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendApprovalEmail({
      to: "u@e.com",
      fullName: "Test",
      role: "editor",
      loginUrl: "https://app.example.com/auth/login",
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.subject).toBe("Your School Gantt access was approved");
  });

  it("email text contains the recipient's full name", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendApprovalEmail({
      to: "u@e.com",
      fullName: "Yael Levi",
      role: "editor",
      loginUrl: "https://app.example.com/auth/login",
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.text).toContain("Yael Levi");
  });

  it("email text contains the assigned role", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await sendApprovalEmail({
      to: "u@e.com",
      fullName: "Test",
      role: "admin",
      loginUrl: "https://app.example.com/auth/login",
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.text).toContain("admin");
  });

  it("email text contains the login URL", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const loginUrl = "https://app.example.com/auth/login?school=abc";
    await sendApprovalEmail({ to: "u@e.com", fullName: "Test", role: "viewer", loginUrl });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.text).toContain(loginUrl);
  });

  it("falls back to the default from address when RESEND_FROM_EMAIL is not set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    // Do NOT stub RESEND_FROM_EMAIL — leave it undefined so ?? triggers the fallback
    delete process.env.RESEND_FROM_EMAIL;
    await sendApprovalEmail({
      to: "u@e.com",
      fullName: "Test",
      role: "editor",
      loginUrl: "https://app.example.com/auth/login",
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.from).toContain("no-reply@example.com");
  });

  it("uses RESEND_FROM_EMAIL when set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "School <noreply@myschool.edu>");
    await sendApprovalEmail({
      to: "u@e.com",
      fullName: "Test",
      role: "editor",
      loginUrl: "https://app.example.com/auth/login",
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.from).toBe("School <noreply@myschool.edu>");
  });
});
