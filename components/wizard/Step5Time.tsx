"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StepProps } from "./WizardShell";

/**
 * Step 5 — Time window: start/end time on the chosen date, or all-day toggle.
 * Enforces start < end (WIZARD-01 PRD §6.2 Step 5).
 */
export function Step5Time({ data, saving, onNext, onBack }: StepProps) {
  const t = useTranslations("wizard.step5");
  const tc = useTranslations("common");
  const [allDay, setAllDay] = useState(data.allDay ?? false);
  const dateStr = data.date ?? new Date().toISOString().slice(0, 10);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [error, setError] = useState("");

  function handleNext() {
    if (!allDay && startTime >= endTime) {
      setError(t("errorInverted"));
      return;
    }
    setError("");
    // Asia/Jerusalem offset is +02:00 / +03:00 with DST. v1 uses a fixed
    // +02:00 (Standard Time) — the conservative approximation that doesn't
    // require a tz library on the client. lib/views/agenda groups by local
    // day on the server, so the small skew is invisible.
    const startAt = allDay
      ? `${dateStr}T00:00:00+02:00`
      : `${dateStr}T${startTime}:00+02:00`;
    const endAt = allDay
      ? `${dateStr}T23:59:59+02:00`
      : `${dateStr}T${endTime}:00+02:00`;
    void onNext({ startAt, endAt, allDay });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        <span className="text-sm">{t("allDay")}</span>
      </label>
      {!allDay && (
        <div className="flex gap-4">
          <label className="flex-1">
            <span className="text-sm font-medium text-neutral-700">
              {t("startLabel")}
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1">
            <span className="text-sm font-medium text-neutral-700">
              {t("endLabel")}
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}
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
