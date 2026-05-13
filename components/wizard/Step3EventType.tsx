"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StepProps, EventType } from "./WizardShell";

interface Step3Props extends StepProps {
  eventTypes: EventType[];
}

/**
 * Step 3 — Event type single-select from school's configured palette.
 */
export function Step3EventType({ data, saving, eventTypes, onNext, onBack }: Step3Props) {
  const t = useTranslations("wizard.step3");
  const tc = useTranslations("common");
  const [eventTypeId, setEventTypeId] = useState(data.eventTypeId ?? "");
  const [error, setError] = useState("");

  function handleNext() {
    if (!eventTypeId) {
      setError(t("errorRequired"));
      return;
    }
    setError("");
    void onNext({ eventTypeId });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <div role="radiogroup" aria-label={t("title")} className="space-y-2">
        {eventTypes.map((et) => {
          const active = eventTypeId === et.id;
          return (
            <button
              key={et.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setEventTypeId(et.id)}
              className={`flex w-full min-h-11 items-center gap-3 rounded-lg border p-3 text-start transition-colors
                ${
                  active
                    ? "border-blue-600 bg-blue-50"
                    : "border-neutral-200 hover:border-blue-300"
                }`}
            >
              <span aria-hidden="true" className="text-lg">
                {et.glyph}
              </span>
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: et.colorHex }}
              />
              <span className="text-sm font-medium">{et.labelHe}</span>
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
