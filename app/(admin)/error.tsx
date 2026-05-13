"use client";

import { ErrorPanel } from "@/components/ErrorPanel";

/**
 * Root error boundary. Caught uncaught render/server errors that don't
 * match a more specific error.tsx in a child segment.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} />;
}
