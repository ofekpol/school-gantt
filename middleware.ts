import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";

const handleI18nRouting = createIntlMiddleware({
  locales: ["he", "en"],
  defaultLocale: "he",
  localePrefix: "as-needed",
});

export async function middleware(request: NextRequest) {
  // Step 1: i18n routing — produces the (potentially redirected) response
  const response = handleI18nRouting(request);

  // If next-intl issued a redirect (e.g., locale prefix), short-circuit before Supabase
  if (response.status >= 300 && response.status < 400) return response;

  // Step 2: Supabase session refresh — writes cookies onto the same response
  // Skip when env vars are absent (test environments without a live Supabase project)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getUser() validates JWT and refreshes if needed. Errors are silent — public routes pass through.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets, images, favicon, and the auth API endpoints (they manage their own cookies).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1/auth/).*)" ],
};
