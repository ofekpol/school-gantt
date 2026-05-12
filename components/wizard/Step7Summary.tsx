"use client";

import { useState } from "react";
import type { StepProps, EventType, WizardData } from "./WizardShell";

const GRADE_LABELS: Record<number, string> = {
  7: "ז׳",
  8: "ח׳",
  9: "ט׳",
  10: "י׳",
  11: "י״א",
  12: "י״ב",
};

interface Step7Props extends StepProps {
  eventTypes: EventType[];
  onSubmit: () => Promise<void>;
}

/**
 * Step 7 — Summary screen. Shows all entered fields and the "Submit for approval" button.
 * WIZARD-06: clicking Submit calls onSubmit() which POSTs to /api/v1/events/:id/submit.
 */
export function Step7Summary({ data, saving, eventTypes, onBack, onSubmit }: Step7Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const eventType = eventTypes.find((et) => et.id === data.eventTypeId);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      await onSubmit();
    } catch {
      setError("שגיאה בשליחה. נסה שוב.");
      setSubmitting(false);
    }
  }

  function formatTime(data: WizardData) {
    if (data.allDay) return "כל היום";
    const start = data.startAt?.slice(11, 16) ?? "";
    const end = data.endAt?.slice(11, 16) ?? "";
    if (!start && !end) return "—";
    return `${start}–${end}`;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">שלב 7 — סיכום ושליחה</h2>
      <dl className="space-y-2 rounded-lg border border-neutral-200 p-4 text-sm">
        <SummaryRow label="תאריך" value={data.date ?? "—"} />
        <SummaryRow
          label="כיתות"
          value={
            (data.grades ?? []).map((g) => GRADE_LABELS[g] ?? String(g)).join(", ") || "—"
          }
        />
        <SummaryRow label="סוג אירוע" value={eventType?.labelHe ?? "—"} />
        <SummaryRow label="שם האירוע" value={data.title ?? "—"} />
        <SummaryRow label="שעות" value={formatTime(data)} />
        <SummaryRow label="אחראי" value={data.responsibleText ?? "—"} />
        {data.requirementsText && (
          <SummaryRow label="דרישות" value={data.requirementsText} />
        )}
      </dl>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          חזור
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || submitting}
          className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? "שולח..." : "שלח לאישור"}
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 font-medium text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  );
}
