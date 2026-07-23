import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { shouldBypassAuthRefresh } from "@/lib/auth/public-request";

/**
 * Auth gate + Supabase session refresh.
 * All routes require authentication except the PUBLIC_PATHS allowlist.
 * Locale is handled by i18n/request.ts via the NEXT_LOCALE cookie —
 * no path-prefix routing, so all routes stay clean regardless of locale.
 */
export async function middleware(request: NextRequest) {
  // Expose pathname to server components so layouts can highlight the
  // active nav link without becoming client components.
  request.headers.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const { pathname } = request.nextUrl;
  if (shouldBypassAuthRefresh(pathname)) return response;

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

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
