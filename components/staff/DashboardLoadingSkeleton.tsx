"use client";

import { useTranslations } from "next-intl";

const calendarCells = Array.from({ length: 21 });

export function DashboardLoadingSkeleton() {
  const t = useTranslations("staffLoading");

  return (
    <main className="min-h-[calc(100vh-5rem)] p-6">
      <div role="status" aria-live="polite" className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-2">
          <p className="text-2xl font-bold text-neutral-900">{t("dashboardTitle")}</p>
          <p className="text-sm text-neutral-500">{t("dashboardDetail")}</p>
        </div>
        <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
          <span className="sg-skel h-9 w-24" />
          <span className="sg-skel h-9 w-28" />
          <span className="sg-skel h-9 w-20" />
        </div>
        <div aria-hidden="true" className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-neutral-200 p-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <span key={index} className="sg-skel mx-2 h-3" />
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarCells.map((_, index) => (
              <span
                key={index}
                data-testid="dashboard-loading-cell"
                className="min-h-24 border-b border-s border-neutral-100 p-3"
              >
                <span className="sg-skel block h-3 w-5" />
                {index % 3 === 0 && <span className="sg-skel mt-5 block h-5 w-full" />}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
