import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Auth gate + Supabase session refresh.
 * All routes require authentication except the PUBLIC_PATHS allowlist.
 * Locale is handled by i18n/request.ts via the NEXT_LOCALE cookie —
 * no path-prefix routing, so all routes stay clean regardless of locale.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Skip Supabase setup in test envs without the keys.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getUser() validates JWT and refreshes the session if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public allowlist — no auth required
  const PUBLIC_PATHS = [
    "/auth/login",
    "/auth/callback",
    "/auth/pending",
    "/auth/deactivated",
    "/invite/",
    "/ical/",
  ];

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isPublic && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
