"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StepProps, EventType, WizardData } from "./WizardShell";

interface Step7Props extends StepProps {
  eventTypes: EventType[];
  onSubmit: () => Promise<void>;
}

/**
 * Step 7 — Summary screen. Shows all entered fields and the "Submit for approval" button.
 * WIZARD-06: clicking Submit calls onSubmit() which POSTs to /api/v1/events/:id/submit.
 */
export function Step7Summary({ data, saving, eventTypes, onBack, onSubmit }: Step7Props) {
  const t = useTranslations("wizard.step7");
  const tc = useTranslations("common");
  const tg = useTranslations("grades");
  const ta = useTranslations("agenda");
  const td = useTranslations("gantt.drawer");
  const tw = useTranslations("wizard.step5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const eventType = eventTypes.find((et) => et.id === data.eventTypeId);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      await onSubmit();
    } catch {
      setError(t("submitError"));
      setSubmitting(false);
    }
  }

  function formatTime(d: WizardData) {
    if (d.allDay) return tw("allDay");
    const start = d.startAt?.slice(11, 16) ?? "";
    const end = d.endAt?.slice(11, 16) ?? "";
    if (!start && !end) return "—";
    return `${start}–${end}`;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <dl className="space-y-2 rounded-lg border border-neutral-200 p-4 text-sm">
        <SummaryRow label={td("date")} value={data.date ?? "—"} />
        <SummaryRow
          label={td("grades")}
          value={
            (data.grades ?? [])
              .map((g) => tg(`label_${g}` as `label_${7 | 8 | 9 | 10 | 11 | 12}`))
              .join(", ") || "—"
          }
        />
        <SummaryRow label={td("type")} value={eventType?.labelHe ?? "—"} />
        <SummaryRow label={td("description")} value={data.title ?? "—"} />
        <SummaryRow label={tw("title")} value={formatTime(data)} />
        <SummaryRow label={td("location")} value={data.responsibleText ?? "—"} />
        {data.requirementsText && (
          <SummaryRow label={ta("location")} value={data.requirementsText} />
        )}
      </dl>
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
          onClick={handleSubmit}
          disabled={saving || submitting}
          className="flex-1 min-h-11 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? t("submitting") : t("submit")}
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
