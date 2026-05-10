import type { ReactNode } from "react";

/**
 * Public route group root layout.
 * AUTH-07: explicitly DOES NOT call getSession() — public routes are unauthenticated.
 * Staff and Admin route groups will have their own layouts that DO check session.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
