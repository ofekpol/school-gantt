/**
 * Canonical i18n config — referenced by middleware, request handler,
 * the LocaleToggle component, and tests. Keep names and types here so
 * one edit moves both server and client surfaces.
 */
export const LOCALES = ["he", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "he";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(s: string | undefined | null): s is Locale {
  return s === "he" || s === "en";
}

/** RTL when Hebrew; LTR for English. Used by the root layout dir attr. */
export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
