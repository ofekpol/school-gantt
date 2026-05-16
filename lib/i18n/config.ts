/**
 * Canonical i18n config — referenced by middleware, request handler,
 * and tests. Hebrew is the only runtime locale for now.
 */
export const LOCALES = ["he"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "he";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(s: string | undefined | null): s is Locale {
  return s === "he";
}

/** Used by the root layout dir attr. */
export function dirFor(_locale: Locale): "rtl" {
  return "rtl";
}
