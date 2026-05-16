"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";

/**
 * Persists a locale in the NEXT_LOCALE cookie and revalidates the current
 * path so next-intl re-reads the cookie via i18n/request.ts.
 */
export async function setLocale(locale: Locale, returnPath: string): Promise<void> {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // Revalidate the originating path so SSR picks up the new locale.
  revalidatePath(returnPath);
}
