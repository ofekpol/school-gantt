"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ZoomLevel } from "@/lib/views/gantt";

interface Props {
  zoom: ZoomLevel;
}

const LEVELS: ZoomLevel[] = ["week", "year", "term", "month"];

export function ZoomToggle({ zoom }: Props) {
  const t = useTranslations("gantt");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setZoom(next: ZoomLevel) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "week") params.delete("zoom");
    else params.set("zoom", next);
    const qs = params.toString();
    startTransition(() => {
      router.replace(
        (qs ? `${pathname}?${qs}` : pathname) as never,
        { scroll: false },
      );
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("zoomLabel")}
      className="inline-flex rounded-md border border-neutral-300 bg-white text-sm"
    >
      {LEVELS.map((level) => {
        const active = zoom === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setZoom(level)}
            className={`min-h-11 px-3 py-1 transition-colors first:rounded-s-md last:rounded-e-md ${
              active ? "bg-neutral-900 text-white" : "text-neutral-700"
            }`}
          >
            {t(`zoom.${level}`)}
          </button>
        );
      })}
    </div>
  );
}
