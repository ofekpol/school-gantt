"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppHeaderNavLink } from "@/components/AppHeader";

function isActiveLink(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

export function AppHeaderNav({
  links,
  initialPath = "",
}: {
  links: AppHeaderNavLink[];
  initialPath?: string;
}) {
  const pathname = usePathname() ?? initialPath;

  return (
    <nav className="flex items-center gap-1 flex-wrap">
      {links.map((link) => {
        const active = isActiveLink(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href as never}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
