"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StepProps } from "./WizardShell";

/**
 * Step 6 — Responsible person (1–80 chars) + requirements logistics text (0–2000 chars).
 * Corresponds to PRD §6.2 Step 6 and Step 6b.
 */
export function Step6Responsible({ data, saving, onNext, onBack }: StepProps) {
  const t = useTranslations("wizard.step6");
  const tc = useTranslations("common");
  const [responsibleText, setResponsibleText] = useState(data.responsibleText ?? "");
  const [requirementsText, setRequirementsText] = useState(data.requirementsText ?? "");
  const [error, setError] = useState("");

  function handleNext() {
    if (!responsibleText.trim()) {
      setError(t("errorRequired"));
      return;
    }
    if (responsibleText.length > 80) {
      setError(t("errorRequired"));
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
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">{t("title")}</span>
        <input
          type="text"
          value={responsibleText}
          maxLength={80}
          onChange={(e) => setResponsibleText(e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">
          {t("requirementsTitle")}
        </span>
        <textarea
          value={requirementsText}
          maxLength={2000}
          onChange={(e) => setRequirementsText(e.target.value)}
          rows={3}
          placeholder={t("requirementsPlaceholder")}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <span className="text-xs text-neutral-400">{requirementsText.length}/2000</span>
      </label>
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
