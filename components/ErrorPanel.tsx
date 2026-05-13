"use client";

import { useTranslations } from "next-intl";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Shared error UI used by every route-group `error.tsx`. Surfaces the
 * digest (a build-time hash of the error stack) so support can correlate
 * client reports with server logs.
 */
export function ErrorPanel({ error, reset }: Props) {
  const tc = useTranslations("common");
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-3">
        <p className="text-lg font-semibold text-red-700">{tc("error")}</p>
        {error.digest && (
          <p className="text-xs text-neutral-500 font-mono">{error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="min-h-11 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          {tc("tryAgain")}
        </button>
      </div>
    </main>
  );
}
