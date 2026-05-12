"use client";

import { useState } from "react";
import type { StepProps } from "./WizardShell";

/**
 * Step 4 — Free-text title (1–120 characters).
 */
export function Step4Title({ data, saving, onNext, onBack }: StepProps) {
  const [title, setTitle] = useState(data.title ?? "");
  const [error, setError] = useState("");

  function handleNext() {
    if (!title.trim()) {
      setError("יש להזין שם לאירוע");
      return;
    }
    if (title.length > 120) {
      setError("שם האירוע ארוך מדי (מקסימום 120 תווים)");
      return;
    }
    setError("");
    void onNext({ title: title.trim() });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">שלב 4 — שם האירוע</h2>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">שם האירוע</span>
        <input
          type="text"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="לדוגמה: טיול שנתי כיתה י׳"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <span className="text-xs text-neutral-400">{title.length}/120</span>
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
