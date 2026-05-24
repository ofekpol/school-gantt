"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

interface RouteProgressContextValue {
  start: (timeoutMs?: number) => void;
}

const RouteProgressContext = createContext<RouteProgressContextValue | null>(null);

export function RouteProgressProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <RouteProgressShell>{children}</RouteProgressShell>
    </Suspense>
  );
}

function RouteProgressShell({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname ?? ""}?${searchParams.toString()}`;
  const previousRouteKey = useRef(routeKey);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);
    timeoutRef.current = null;
    delayRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    setActive(false);
    setVisible(false);
  }, [clearTimers]);

  const start = useCallback((timeoutMs = 8000) => {
    clearTimers();
    setActive(true);
    delayRef.current = setTimeout(() => setVisible(true), 120);
    timeoutRef.current = setTimeout(stop, timeoutMs);
  }, [clearTimers, stop]);

  useEffect(() => {
    if (previousRouteKey.current !== routeKey) {
      previousRouteKey.current = routeKey;
      stop();
    }
  }, [routeKey, stop]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value = useMemo(() => ({ start }), [start]);

  return (
    <RouteProgressContext.Provider value={value}>
      {children}
      {active && (
        <div
          aria-hidden="true"
          className={`fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-transparent transition-opacity ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="h-full w-1/2 animate-[sg-route-progress_1.1s_ease-in-out_infinite] rounded-e-full bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.55)]" />
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-4 start-4 z-[100] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-lg transition ${
          active && visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        {t("loading")}
      </div>
    </RouteProgressContext.Provider>
  );
}

export function useRouteProgress() {
  const context = useContext(RouteProgressContext);
  return context?.start ?? (() => undefined);
}
