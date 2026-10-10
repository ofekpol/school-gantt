import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * "Continue as guest" entry to the public read-only schedule. Shown on every
 * auth surface (login, register, invite) so anyone can view the whole calendar
 * without an account, regardless of how they reached the app.
 */
export function GuestViewButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <Link
      href="/schedule"
      data-testid="guest-view-button"
      className={cn(
        "inline-flex w-full items-center justify-center rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-accent",
        className,
      )}
    >
      {label}
    </Link>
  );
}
