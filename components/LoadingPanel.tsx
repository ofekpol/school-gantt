"use client";

import { useTranslations } from "next-intl";

/**
 * Shared loading skeleton used by every route-group `loading.tsx`.
 * Visible only during streaming SSR — keeps the screen reader engaged
 * with an aria-live message instead of staring at a blank page.
 */
export function LoadingPanel() {
  const tc = useTranslations("common");
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <p role="status" aria-live="polite" className="text-sm text-neutral-500">
        {tc("loading")}
      </p>
    </main>
  );
}
