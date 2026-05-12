import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import type { ReactNode } from "react";

/**
 * Staff route group layout.
 * AUTH guard: redirects unauthenticated users to "/" (public home).
 * All routes under (staff)/ are protected by this layout.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/");
  return <>{children}</>;
}
