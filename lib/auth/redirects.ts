import type { Route } from "next";
import type { StaffUserRecord } from "@/lib/auth/session";

const REDIRECT_BASE = "http://redirect.invalid";

/**
 * Returns a same-origin path for `raw`, or `fallback`. Resolves the value the
 * way the browser will, so protocol-relative (`//evil.com`), backslash
 * (`/\evil.com`) and tab/newline-smuggled forms cannot leave the origin.
 */
export function safeRedirectPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  const resolved = new URL(raw, REDIRECT_BASE);
  if (resolved.origin !== REDIRECT_BASE) return fallback;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

export function getPostLoginRedirect(user: StaffUserRecord | null): Route {
  if (!user) return "/auth/login";
  if (user.status === "pending") return "/auth/pending";
  if (user.status === "deactivated") return "/auth/deactivated";
  if (user.mustChangePassword) return "/auth/change-password";
  if (!user.schoolId) return "/auth/pending";

  return "/dashboard";
}
