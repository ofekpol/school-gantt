const PUBLIC_PREFIXES = [
  "/auth/login",
  "/auth/callback",
  "/auth/confirm",
  "/auth/register",
  "/auth/pending",
  "/auth/deactivated",
  "/auth/change-password",
  "/invite/",
  "/ical/",
  "/api/v1/auth/signin",
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/public/",
  "/api/v1/export/",
  "/api/v1/ical-subscriptions/personal",
];

const RESERVED_PREFIXES = [
  "/auth", "/invite", "/ical", "/api", "/admin",
  "/dashboard", "/events", "/profile", "/_next",
];

export function shouldBypassAuthRefresh(pathname: string): boolean {
  if (pathname === "/") return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return (
    !RESERVED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
    /^\/[^/]+(\/calendar|\/agenda)?$/.test(pathname)
  );
}
