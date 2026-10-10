"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatGradeLabel } from "@/lib/grades";
import {
  DEFAULT_GRADE_COLORS,
  GRADE_COLOR_OPTIONS,
  SCHOOL_GRADES,
  gradeTextColor,
  type GradeColorMap,
} from "@/lib/grade-colors";

interface Props {
  initial: GradeColorMap;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Admin picker for per-grade calendar colors (curated palette only). */
export function GradeColorSettings({ initial }: Props) {
  const t = useTranslations("admin.gradeColors");
  const [colors, setColors] = useState<GradeColorMap>(initial);
  const [state, setState] = useState<SaveState>("idle");

  function pick(grade: number, color: string) {
    setColors((current) => ({ ...current, [grade]: color }));
    setState("idle");
  }

  async function save() {
    setState("saving");
    const res = await fetch("/api/v1/admin/grade-colors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        colors: SCHOOL_GRADES.map((grade) => ({ grade, colorHex: colors[grade] })),
      }),
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  }

  return (
    <section aria-labelledby="grade-colors-title" className="mt-10 max-w-3xl">
      <h2 id="grade-colors-title" className="text-xl font-bold">{t("title")}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t("description")}</p>
      <ul className="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {SCHOOL_GRADES.map((grade) => (
          <GradeColorRow
            key={grade}
            grade={grade}
            color={colors[grade]}
            duplicateOf={SCHOOL_GRADES.find((other) => other !== grade && colors[other] === colors[grade])}
            onPick={(color) => pick(grade, color)}
          />
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === "saving"} className="sg-button-primary rounded-md px-4 py-2 text-sm">
          {t("save")}
        </button>
        <button
          type="button"
          onClick={() => { setColors({ ...DEFAULT_GRADE_COLORS }); setState("idle"); }}
          className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm"
        >
          {t("reset")}
        </button>
        <span role="status" className="text-sm text-neutral-600">
          {state === "saved" ? t("saved") : state === "error" ? t("error") : ""}
        </span>
      </div>
    </section>
  );
}

interface RowProps {
  grade: number;
  color: string;
  duplicateOf: number | undefined;
  onPick: (color: string) => void;
}

function GradeColorRow({ grade, color, duplicateOf, onPick }: RowProps) {
  const t = useTranslations("admin.gradeColors");
  const label = formatGradeLabel(grade);
  return (
    <li className="flex flex-wrap items-center gap-4 px-4 py-3">
      <span
        className="inline-flex h-9 min-w-24 items-center justify-center rounded-md px-3 text-sm font-semibold"
        style={{ backgroundColor: color, color: gradeTextColor(color) }}
      >
        {t("gradeLabel", { grade: label })}
      </span>
      <div role="radiogroup" aria-label={t("gradeLabel", { grade: label })} className="flex flex-wrap gap-1.5">
        {GRADE_COLOR_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === color}
            aria-label={t("colorOption", { grade: label, color: option })}
            onClick={() => onPick(option)}
            className={`size-8 rounded-full border ${option === color ? "ring-2 ring-neutral-900 ring-offset-2" : "border-black/15"}`}
            style={{ backgroundColor: option }}
          />
        ))}
      </div>
      {duplicateOf !== undefined && (
        <span className="text-sm font-medium text-amber-800">
          {t("duplicate", { grade: formatGradeLabel(duplicateOf) })}
        </span>
      )}
    </li>
  );
}
