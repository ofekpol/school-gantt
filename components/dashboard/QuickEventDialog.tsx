"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { EventType } from "@/components/wizard/WizardShell";

interface Props {
  open: boolean;
  dateIso: string | null;
  yearBounds: { startDate: string; endDate: string } | null;
  eventTypes: EventType[];
  allowedGrades: number[];
  onClose: () => void;
}

interface QuickEventData {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  eventTypeId: string;
  grades: number[];
  responsibleText: string;
}

const EMPTY_DATA: QuickEventData = {
  title: "",
  description: "",
  date: "",
  startTime: "08:00",
  endTime: "09:00",
  allDay: false,
  eventTypeId: "",
  grades: [],
  responsibleText: "",
};

export function QuickEventDialog({
  open,
  dateIso,
  yearBounds,
  eventTypes,
  allowedGrades,
  onClose,
}: Props) {
  const router = useRouter();
  const tc = useTranslations("common");
  const tg = useTranslations("grades");
  const t1 = useTranslations("wizard.step1");
  const t2 = useTranslations("wizard.step2");
  const t3 = useTranslations("wizard.step3");
  const t4 = useTranslations("wizard.step4");
  const t5 = useTranslations("wizard.step5");
  const t6 = useTranslations("wizard.step6");
  const t7 = useTranslations("wizard.step7");
  const te = useTranslations("wizard.editor");
  const td = useTranslations("dashboard");
  const [data, setData] = useState<QuickEventData>(EMPTY_DATA);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setData({
      ...EMPTY_DATA,
      date: dateIso ?? new Date().toISOString().slice(0, 10),
    });
    setError("");
    setPublishing(false);
  }, [dateIso, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  function patch(patchData: Partial<QuickEventData>) {
    setData((current) => ({ ...current, ...patchData }));
    setError("");
  }

  function validate(): string {
    if (!data.title.trim()) return t4("errorRequired");
    if (!data.date) return t1("errorRequired");
    if (yearBounds && (data.date < yearBounds.startDate || data.date > yearBounds.endDate)) {
      return t1("errorOutOfYear");
    }
    if (!data.eventTypeId) return t3("errorRequired");
    if (data.grades.length === 0) return t2("errorRequired");
    if (!data.allDay && data.startTime >= data.endTime) return t5("errorInverted");
    return "";
  }

  async function publish() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const startAt = data.allDay
      ? `${data.date}T00:00:00+02:00`
      : `${data.date}T${data.startTime}:00+02:00`;
    const endAt = data.allDay
      ? `${data.date}T23:59:59+02:00`
      : `${data.date}T${data.endTime}:00+02:00`;

    setPublishing(true);
    try {
      const createRes = await fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventTypeId: data.eventTypeId }),
      });
      if (!createRes.ok) throw new Error("Failed to create event");

      const created = (await createRes.json()) as { id: string };
      const patchRes = await fetch(`/api/v1/events/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title.trim(),
          description: data.description.trim() || undefined,
          location: data.responsibleText.trim() || undefined,
          grades: data.grades,
          startAt,
          endAt,
          allDay: data.allDay,
        }),
      });
      if (!patchRes.ok) throw new Error("Failed to save event");

      const submitRes = await fetch(`/api/v1/events/${created.id}/submit`, {
        method: "POST",
      });
      if (!submitRes.ok) throw new Error("Failed to publish event");

      onClose();
      router.refresh();
    } catch {
      setError(t7("submitError"));
      setPublishing(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-event-title"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-3 py-20"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--sg-hairline)] px-5 py-4">
          <h2 id="quick-event-title" className="text-xl font-semibold text-[var(--sg-ink)]">
            {td("newEvent")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tc("cancel")}
            className="grid size-8 place-items-center rounded-full text-[var(--sg-ink-soft)] hover:bg-[var(--sg-surface-2)]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <Field label={t4("title")}>
            <input
              type="text"
              value={data.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={te("titlePlaceholder")}
              aria-label={t4("title")}
              className="h-11 w-full rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] px-3 text-base outline-none focus:border-sky-400 focus:bg-white"
              autoFocus
            />
          </Field>

          <Field label={te("detailsLabel")}>
            <textarea
              value={data.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder={te("detailsPlaceholder")}
              aria-label={te("detailsLabel")}
              rows={3}
              className="w-full resize-y rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t1("title")}>
              <input
                type="date"
                value={data.date}
                min={yearBounds?.startDate}
                max={yearBounds?.endDate}
                onChange={(e) => patch({ date: e.target.value })}
                aria-label={t1("title")}
                className="h-10 w-full rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] px-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
              />
            </Field>
            <Field label={t5("title")}>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="time"
                  value={data.startTime}
                  disabled={data.allDay}
                  onChange={(e) => patch({ startTime: e.target.value })}
                  aria-label={t5("startLabel")}
                  className="h-10 min-w-0 rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] px-2 text-sm outline-none focus:border-sky-400 focus:bg-white disabled:opacity-45"
                />
                <input
                  type="time"
                  value={data.endTime}
                  disabled={data.allDay}
                  onChange={(e) => patch({ endTime: e.target.value })}
                  aria-label={t5("endLabel")}
                  className="h-10 min-w-0 rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] px-2 text-sm outline-none focus:border-sky-400 focus:bg-white disabled:opacity-45"
                />
                <label className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] px-2 text-xs">
                  <input
                    type="checkbox"
                    checked={data.allDay}
                    onChange={(e) => patch({ allDay: e.target.checked })}
                  />
                  <span className="whitespace-nowrap">{t5("allDay")}</span>
                </label>
              </div>
            </Field>
          </div>

          <Field label={t3("title")}>
            <select
              value={data.eventTypeId}
              onChange={(e) => patch({ eventTypeId: e.target.value })}
              aria-label={t3("title")}
              className="h-10 w-full rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] px-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
            >
              <option value="">{te("selectType")}</option>
              {eventTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.glyph} {type.labelHe}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t2("title")}>
            <div className="flex flex-wrap gap-2">
              {allowedGrades.map((grade) => {
                const active = data.grades.includes(grade);
                return (
                  <button
                    key={grade}
                    type="button"
                    data-grade={grade}
                    aria-pressed={active}
                    onClick={() =>
                      patch({
                        grades: active
                          ? data.grades.filter((g) => g !== grade)
                          : [...data.grades, grade],
                      })
                    }
                    className={`min-h-9 min-w-10 rounded-full border px-3 text-sm font-medium ${
                      active
                        ? "border-[var(--sg-ink)] bg-[var(--sg-ink)] text-white"
                        : "border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] text-[var(--sg-ink)] hover:border-sky-300"
                    }`}
                  >
                    {tg(`label_${grade}` as `label_${7 | 8 | 9 | 10 | 11 | 12}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          <details className="rounded-xl bg-[var(--sg-surface-2)] px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-[var(--sg-ink-mute)]">
              {te("moreOptions")}
            </summary>
            <input
              type="text"
              value={data.responsibleText}
              onChange={(e) => patch({ responsibleText: e.target.value })}
              placeholder={te("responsiblePlaceholder")}
              aria-label={t6("title")}
              className="mt-3 h-10 w-full rounded-xl border border-[var(--sg-hairline)] bg-white px-3 text-sm outline-none focus:border-sky-400"
            />
          </details>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--sg-hairline)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[var(--sg-hairline)] bg-white px-4 text-sm font-medium text-[var(--sg-ink-mute)] hover:bg-[var(--sg-surface-2)]"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="h-10 rounded-xl bg-sky-500 px-5 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {publishing ? t7("submitting") : t7("submit")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold tracking-wide text-[var(--sg-ink-soft)] uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
