import { AppHeader } from "@/components/AppHeader";
import type { ReactNode } from "react";

/**
 * Public route group root layout.
 * AUTH-07: explicitly DOES NOT call getSession() — public routes are
 * unauthenticated. Staff and Admin route groups have their own layouts
 * that DO check the session. Mounts AppHeader so the LocaleToggle is
 * available on every public page.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
