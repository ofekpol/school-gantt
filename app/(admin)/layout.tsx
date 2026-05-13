import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";
import type { ReactNode } from "react";

/**
 * Admin route group layout.
 * AUTH guard: redirects unauthenticated users to /login.
 * ROLE guard: redirects non-admin (editor) users to /dashboard.
 * All routes under (admin)/ require role='admin'.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/");
  if (user.role !== "admin") redirect("/dashboard");
  return (
    <div className="min-h-screen">
      <AppHeader title={user.fullName} subtitle={user.email} />
      {children}
    </div>
  );
}
