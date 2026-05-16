import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";
import type { ReactNode } from "react";

/**
 * Staff route group layout.
 * AUTH guard: redirects unauthenticated users to /auth/login.
 * STATUS guard: pending users → /auth/pending; deactivated → /auth/deactivated.
 * All routes under (staff)/ are protected by this layout.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/auth/login");
  if (user.status === "pending") redirect("/auth/pending");
  if (user.status === "deactivated") redirect("/auth/deactivated");
  if (user.role === "viewer") redirect(user.schoolSlug ? `/${user.schoolSlug}` : "/auth/pending");
  return (
    <>
      <AppHeader title={user.fullName} subtitle={user.email} />
      {children}
    </>
  );
}
