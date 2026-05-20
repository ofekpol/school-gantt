import "server-only";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { AppHeaderNavLink } from "@/components/AppHeader";

/**
 * Returns the request pathname stamped by middleware ("x-pathname"),
 * or an empty string when unavailable (e.g. in tests).
 */
export async function getCurrentPath(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") ?? "";
}

/**
 * Builds the in-header nav for a staff or admin user. Admins also see
 * the admin-only sections (Staff, Event Types, Year).
 */
export async function buildNavLinks(
  role: "editor" | "admin" | "viewer",
): Promise<AppHeaderNavLink[]> {
  const t = await getTranslations("nav");
  const links: AppHeaderNavLink[] = [
    { href: "/dashboard", label: t("dashboard") },
  ];
  if (role === "admin") {
    links.push(
      { href: "/admin/staff", label: t("staff") },
      { href: "/admin/event-types", label: t("eventTypes") },
      { href: "/admin/year", label: t("year") },
    );
  }
  links.push({ href: "/profile", label: t("profile") });
  return links;
}
