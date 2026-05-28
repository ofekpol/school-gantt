import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { buildNavLinks, getCurrentPath } from "@/lib/nav";
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
  if (user.mustChangePassword) redirect("/auth/change-password");
  const [navLinks, currentPath, t] = await Promise.all([
    buildNavLinks(user.role),
    getCurrentPath(),
    getTranslations("nav"),
  ]);
  return (
    <>
      <AppHeader
        title={user.fullName}
        subtitle={user.email}
        navLinks={navLinks}
        currentPath={currentPath}
        rightSlot={
          <>
            <span className="max-w-48 truncate text-sm font-medium text-neutral-900">
              {user.fullName}
            </span>
            <LogoutButton label={t("logout")} />
          </>
        }
      />
      {children}
    </>
  );
}
