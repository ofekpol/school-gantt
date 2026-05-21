"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Color-blind-safe preset palette (Tableau 10 + greys). */
const PRESETS = [
  "#1f77b4",
  "#d62728",
  "#9467bd",
  "#2ca02c",
  "#ff7f0e",
  "#8c564b",
  "#17becf",
  "#bcbd22",
  "#e377c2",
  "#7f7f7f",
  "#aec7e8",
  "#393b79",
];

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

/**
 * Color selector: a grid of clickable preset swatches plus a native
 * picker for custom hex. Emits #RRGGBB (matches EventTypeSchema regex).
 */
export function ColorPicker({ value, onChange }: Props) {
  const t = useTranslations("admin.eventTypes");
  const customId = useId();
  const normalized = value.toLowerCase();

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={t("chooseColor")} className="flex flex-wrap gap-1.5">
        {PRESETS.map((hex) => {
          const selected = hex.toLowerCase() === normalized;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={hex}
              title={hex}
              onClick={() => onChange(hex)}
              style={{ background: hex }}
              className={cn(
                "h-7 w-7 rounded-md border transition focus:outline-none focus:ring-2 focus:ring-offset-1",
                selected ? "ring-2 ring-offset-1 ring-black border-black" : "border-black/20",
              )}
            />
          );
        })}
      </div>
      <label htmlFor={customId} className="flex items-center gap-2 text-sm">
        <input
          id={customId}
          type="color"
          value={normalized}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border p-0"
        />
        <span>{t("customColor")}</span>
        <span className="font-mono text-xs text-muted-foreground">{normalized}</span>
      </label>
    </div>
  );
}
