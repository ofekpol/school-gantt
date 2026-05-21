import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { buildNavLinks, getCurrentPath } from "@/lib/nav";
import type { ReactNode } from "react";

/**
 * Admin route group layout.
 * AUTH guard: redirects unauthenticated users to /auth/login.
 * STATUS guard: pending users → /auth/pending; deactivated → /auth/deactivated.
 * ROLE guard: redirects viewers to /dashboard. Per-page guards enforce
 * admin-only access for staff/year; event-types also allows editors.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/auth/login");
  if (user.status === "pending") redirect("/auth/pending");
  if (user.status === "deactivated") redirect("/auth/deactivated");
  if (user.mustChangePassword) redirect("/auth/change-password");
  if (user.role === "viewer") redirect("/dashboard");
  const [navLinks, currentPath, t] = await Promise.all([
    buildNavLinks(user.role),
    getCurrentPath(),
    getTranslations("nav"),
  ]);
  return (
    <div className="min-h-screen">
      <AppHeader
        title={user.fullName}
        subtitle={user.email}
        navLinks={navLinks}
        currentPath={currentPath}
        rightSlot={<LogoutButton label={t("logout")} />}
      />
      {children}
    </div>
  );
}
