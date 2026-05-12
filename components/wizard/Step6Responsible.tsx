"use client";

import { useState } from "react";
import type { StepProps } from "./WizardShell";

/**
 * Step 6 — Responsible person (1–80 chars) + requirements logistics text (0–2000 chars).
 * Corresponds to PRD §6.2 Step 6 and Step 6b.
 */
export function Step6Responsible({ data, saving, onNext, onBack }: StepProps) {
  const [responsibleText, setResponsibleText] = useState(data.responsibleText ?? "");
  const [requirementsText, setRequirementsText] = useState(data.requirementsText ?? "");
  const [error, setError] = useState("");

  function handleNext() {
    if (!responsibleText.trim()) {
      setError("יש להזין שם אחראי");
      return;
    }
    if (responsibleText.length > 80) {
      setError("שם האחראי ארוך מדי (מקסימום 80 תווים)");
      return;
    }
    setError("");
    void onNext({
      responsibleText: responsibleText.trim(),
      requirementsText: requirementsText.trim() || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">שלב 6 — אחראי ודרישות</h2>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">שם האחראי</span>
        <input
          type="text"
          value={responsibleText}
          maxLength={80}
          onChange={(e) => setResponsibleText(e.target.value)}
          placeholder="לדוגמה: יעקב לוי"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">
          דרישות לוגיסטיות{" "}
          <span className="font-normal text-neutral-400">(רשות)</span>
        </span>
        <textarea
          value={requirementsText}
          maxLength={2000}
          onChange={(e) => setRequirementsText(e.target.value)}
          rows={3}
          placeholder="ציוד נדרש, חדרים, הסעות..."
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <span className="text-xs text-neutral-400">{requirementsText.length}/2000</span>
      </label>
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
