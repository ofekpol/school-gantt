import type { Route } from "next";
import type { StaffUserRecord } from "@/lib/auth/session";

export function getPostLoginRedirect(user: StaffUserRecord | null): Route {
  if (!user) return "/auth/login";
  if (user.status === "pending") return "/auth/pending";
  if (user.status === "deactivated") return "/auth/deactivated";
  if (user.mustChangePassword) return "/auth/change-password";
  if (!user.schoolId) return "/auth/pending";

  return "/dashboard";
}
