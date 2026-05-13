"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/config";

/**
 * he ↔ en toggle. Writes the cookie via a server action and then refreshes
 * the route so the cookie-driven request handler reloads the messages.
 *
 * Lives in /components (not Gantt or staff-specific) because every header
 * mounts it.
 */
export function LocaleToggle() {
  const ta = useTranslations("a11y");
  const router = useRouter();
  const pathname = usePathname();
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  function set(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale, pathname);
      router.refresh();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label={ta("localeToggle")}
      className="inline-flex rounded-md border border-neutral-300 bg-white text-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={current === "he"}
        onClick={() => set("he")}
        disabled={pending}
        className={`min-h-9 px-2.5 py-1 first:rounded-s-md ${
          current === "he"
            ? "bg-neutral-900 text-white"
            : "text-neutral-700"
        }`}
      >
        {ta("localeHe")}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={current === "en"}
        onClick={() => set("en")}
        disabled={pending}
        className={`min-h-9 px-2.5 py-1 last:rounded-e-md ${
          current === "en"
            ? "bg-neutral-900 text-white"
            : "text-neutral-700"
        }`}
      >
        {ta("localeEn")}
      </button>
    </div>
  );
}
