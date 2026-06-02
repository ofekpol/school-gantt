"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StepProps } from "./WizardShell";

export function Step1Date({ data, saving, onNext }: StepProps) {
  const t = useTranslations("wizard.step1");
  const tc = useTranslations("common");
  const [date, setDate] = useState(data.date ?? "");
  const [error, setError] = useState("");

  function handleNext() {
    if (!date) {
      setError(t("errorRequired"));
      return;
    }
    setError("");
    void onNext({ date });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">{t("title")}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        onClick={handleNext}
        disabled={saving}
        className="w-full min-h-11 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? tc("saving") : tc("next")}
      </button>
    </div>
  );
}
