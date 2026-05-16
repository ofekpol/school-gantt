import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
} from "@/lib/i18n/config";

/**
 * next-intl 3 request handler — resolves the active locale from the
 * NEXT_LOCALE cookie when valid, falling back to Hebrew.
 *
 * Loaded automatically because next.config.ts wires
 * `createNextIntlPlugin('./i18n/request.ts')`.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  const messages = (await import(`@/messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: "Asia/Jerusalem",
  };
});
