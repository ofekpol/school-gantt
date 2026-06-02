"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus } from "lucide-react";
import { formatGradeLabel } from "@/lib/grades";

interface ExportEventType {
  key: string;
  labelHe: string;
  colorHex: string;
}

interface Props {
  schoolSlug: string;
  allGrades: number[];
  eventTypes: ExportEventType[];
  defaultGrades: number[];
  defaultTypes: string[];
}

/**
 * Opens a modal to export the school's events as an `.ics` file, pre-seeded
 * with the viewer's active grade / event-type filters. The download hits the
 * public GET /api/v1/export/ics route. Quick-add (single event) lives in the
 * event detail surfaces instead.
 */
export function ExportToGoogleCalendarButton({
  schoolSlug,
  allGrades,
  eventTypes,
  defaultGrades,
  defaultTypes,
}: Props) {
  const t = useTranslations("export");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        {t("button")}
      </button>
      {open && (
        <ExportModal
          schoolSlug={schoolSlug}
          allGrades={allGrades}
          eventTypes={eventTypes}
          defaultGrades={defaultGrades}
          defaultTypes={defaultTypes}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ExportModal({
  schoolSlug,
  allGrades,
  eventTypes,
  defaultGrades,
  defaultTypes,
  onClose,
}: Props & { onClose: () => void }) {
  const t = useTranslations("export");
  const [grades, setGrades] = useState<number[]>(defaultGrades);
  const [types, setTypes] = useState<string[]>(defaultTypes);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function exportIcs() {
    const query = new URLSearchParams({ school: schoolSlug });
    if (grades.length > 0) query.set("grades", grades.join(","));
    if (types.length > 0) query.set("eventTypes", types.join(","));
    const link = document.createElement("a");
    link.href = `/api/v1/export/ics?${query.toString()}`;
    link.download = "school-events.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-5 shadow-2xl"
      >
        <h2 id="export-modal-title" className="text-lg font-semibold text-neutral-900">
          {t("modalTitle")}
        </h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-neutral-700">
            {t("gradesLabel")}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {allGrades.map((g) => {
              const on = grades.length === 0 || grades.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGrades((prev) => toggle(prev, g))}
                  className={`min-w-11 rounded-md border px-3 py-1 text-sm font-semibold transition-colors ${
                    on
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700"
                  }`}
                >
                  {formatGradeLabel(g)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-neutral-700">
            {t("typesLabel")}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {eventTypes.map((et) => {
              const on = types.length === 0 || types.includes(et.key);
              return (
                <button
                  key={et.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTypes((prev) => toggle(prev, et.key))}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-sm transition-colors ${
                    on
                      ? "border-blue-600 bg-blue-50 text-neutral-900"
                      : "border-neutral-200 bg-neutral-50 text-neutral-500"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: et.colorHex }}
                  />
                  {et.labelHe}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
          <p>{t("importNote")}</p>
          <p className="mt-1 text-neutral-500">{t("desktopOnlyNote")}</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            {t("close")}
          </button>
          <button
            type="button"
            onClick={exportIcs}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            {t("exportAction")}
          </button>
        </div>
      </div>
    </div>
  );
}
