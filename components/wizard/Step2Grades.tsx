"use client";

import { useState } from "react";
import type { StepProps } from "./WizardShell";

const GRADE_LABELS: Record<number, string> = {
  7: "ז׳",
  8: "ח׳",
  9: "ט׳",
  10: "י׳",
  11: "י״א",
  12: "י״ב",
};

interface Step2Props extends StepProps {
  allowedGrades: number[];
}

/**
 * Step 2 — Grade multi-select restricted to editor's scope (WIZARD-05).
 */
export function Step2Grades({ data, saving, allowedGrades, onNext, onBack }: Step2Props) {
  const [grades, setGrades] = useState<number[]>(data.grades ?? []);
  const [error, setError] = useState("");

  function toggle(g: number) {
    setGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  function handleNext() {
    if (grades.length === 0) {
      setError("יש לבחור כיתה אחת לפחות");
      return;
    }
    setError("");
    void onNext({ grades });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">שלב 2 — כיתות</h2>
      <div className="flex flex-wrap gap-2">
        {allowedGrades.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => toggle(g)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors
              ${
                grades.includes(g)
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-blue-400"
              }`}
          >
            {GRADE_LABELS[g] ?? g}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          חזור
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "שומר..." : "הבא"}
        </button>
      </div>
    </div>
  );
}
