import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Supabase session refresh. Locale is handled by i18n/request.ts via the
 * NEXT_LOCALE cookie — no path-prefix routing, so all routes stay clean
 * regardless of the active locale.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

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

  // getUser() validates JWT and refreshes if needed. Errors are silent —
  // public routes pass through.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets and self-managed auth endpoints.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1/auth/).*)"],
};
