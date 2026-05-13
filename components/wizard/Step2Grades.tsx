"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StepProps } from "./WizardShell";

interface Step2Props extends StepProps {
  allowedGrades: number[];
}

/**
 * Step 2 — Grade multi-select restricted to editor's scope (WIZARD-05).
 */
export function Step2Grades({ data, saving, allowedGrades, onNext, onBack }: Step2Props) {
  const t = useTranslations("wizard.step2");
  const tc = useTranslations("common");
  const tg = useTranslations("grades");
  const [grades, setGrades] = useState<number[]>(data.grades ?? []);
  const [error, setError] = useState("");

  function toggle(g: number) {
    setGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  function handleNext() {
    if (grades.length === 0) {
      setError(t("errorRequired"));
      return;
    }
    setError("");
    void onNext({ grades });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <div className="flex flex-wrap gap-2">
        {allowedGrades.map((g) => {
          const active = grades.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              aria-pressed={active}
              className={`min-h-11 min-w-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors
                ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-blue-400"
                }`}
            >
              {tg(`label_${g}` as `label_${7 | 8 | 9 | 10 | 11 | 12}`)}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 min-h-11 rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          {tc("back")}
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex-1 min-h-11 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? tc("saving") : tc("next")}
        </button>
      </div>
    </div>
  );
}
