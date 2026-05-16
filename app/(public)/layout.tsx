import type { ReactNode } from "react";

/**
 * Public route group root layout.
 * AUTH-07: explicitly DOES NOT call getSession() — public routes are
 * unauthenticated. Each public page renders its own header.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
