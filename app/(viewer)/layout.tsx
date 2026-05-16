import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import type { ReactNode } from "react";

export default async function ViewerLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/auth/login");
  if (user.status === "pending") redirect("/auth/pending");
  if (user.status === "deactivated") redirect("/auth/deactivated");
  if (!user.schoolId) redirect("/auth/pending");
  return <>{children}</>;
}
