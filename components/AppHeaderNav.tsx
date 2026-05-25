"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { AppHeaderNavLink } from "@/components/AppHeader";
import { useRouteProgress } from "@/components/RouteProgress";

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
  const router = useRouter();
  const startRouteProgress = useRouteProgress();

  useEffect(() => {
    const prefetch = () => {
      for (const link of links) router.prefetch(link.href as never);
    };
    const idle = window.requestIdleCallback?.(prefetch) ?? window.setTimeout(prefetch, 300);
    return () => {
      if (typeof idle === "number") window.clearTimeout(idle);
      else window.cancelIdleCallback?.(idle);
    };
  }, [links, router]);

  return (
    <nav className="flex items-center gap-1 flex-wrap">
      {links.map((link) => {
        const active = isActiveLink(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href as never}
            prefetch
            onMouseEnter={() => router.prefetch(link.href as never)}
            onFocus={() => router.prefetch(link.href as never)}
            onClick={() => {
              if (!active) startRouteProgress();
            }}
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
