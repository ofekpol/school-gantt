import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";
import { buildNavLinks, getCurrentPath } from "@/lib/nav";
import type { ReactNode } from "react";

/**
 * Admin route group layout.
 * AUTH guard: redirects unauthenticated users to /auth/login.
 * STATUS guard: pending users → /auth/pending; deactivated → /auth/deactivated.
 * ROLE guard: redirects non-admin users to /dashboard.
 * All routes under (admin)/ require role='admin'.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/auth/login");
  if (user.status === "pending") redirect("/auth/pending");
  if (user.status === "deactivated") redirect("/auth/deactivated");
  if (user.mustChangePassword) redirect("/auth/change-password");
  if (user.role !== "admin") redirect("/dashboard");
  const [navLinks, currentPath] = await Promise.all([
    buildNavLinks(user.role),
    getCurrentPath(),
  ]);
  return (
    <div className="min-h-screen">
      <AppHeader
        title={user.fullName}
        subtitle={user.email}
        navLinks={navLinks}
        currentPath={currentPath}
      />
      {children}
    </div>
  );
}
