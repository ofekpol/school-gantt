"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { AgendaItem } from "@/lib/views/agenda";

interface Props {
  event: AgendaItem | null;
  onClose: () => void;
}

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  dateStyle: "full",
});
const timeFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
});

export function EventDrawer({ event, onClose }: Props) {
  const t = useTranslations("gantt.drawer");
  const ta = useTranslations("a11y");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape; focus the close button on open for keyboard a11y.
  useEffect(() => {
    if (!event) return;
    closeButtonRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [event, onClose]);

  if (!event) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-drawer-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-xl sm:rounded-xl shadow-xl p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className="inline-block size-3 shrink-0 rounded-full border border-neutral-300"
              style={{ backgroundColor: event.eventTypeColor }}
            />
            <h2 id="event-drawer-title" className="text-lg font-semibold truncate">
              {event.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={ta("closeDialog")}
            className="min-h-11 min-w-11 text-neutral-500 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
          >
            ✕
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-neutral-500">{t("date")}</dt>
            <dd>
              {dateFmt.format(new Date(event.startAt))}
              {!event.allDay && (
                <>
                  {" · "}
                  {timeFmt.format(new Date(event.startAt))}
                  {" – "}
                  {timeFmt.format(new Date(event.endAt))}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">{t("type")}</dt>
            <dd className="flex items-center gap-1">
              <span aria-hidden="true">{event.eventTypeGlyph}</span>
              {event.eventTypeLabelHe}
            </dd>
          </div>
          {event.grades.length > 0 && (
            <div>
              <dt className="text-neutral-500">{t("grades")}</dt>
              <dd>{event.grades.join(", ")}</dd>
            </div>
          )}
          {event.location && (
            <div>
              <dt className="text-neutral-500">{t("location")}</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {event.description && (
            <div>
              <dt className="text-neutral-500">{t("description")}</dt>
              <dd className="whitespace-pre-wrap">{event.description}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
