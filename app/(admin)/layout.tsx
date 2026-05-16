import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";
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
  if (user.role !== "admin") redirect("/dashboard");
  return (
    <div className="min-h-screen">
      <AppHeader title={user.fullName} subtitle={user.email} />
      {children}
    </div>
  );
}
