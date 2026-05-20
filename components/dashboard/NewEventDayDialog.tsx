"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  open: boolean;
  dateIso: string | null;
  onClose: () => void;
}

/**
 * Confirm dialog shown when a user clicks a day cell on the dashboard
 * weekly/monthly view. On confirm, routes to the wizard with `?date=`
 * pre-filled. Plain inline modal — no shadcn Dialog dep available.
 */
export function NewEventDayDialog({ open, dateIso, onClose }: Props) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !dateIso) return null;

  const displayDate = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateIso}T12:00:00Z`));

  function confirm() {
    if (!dateIso) return;
    router.push(`/events/new?date=${dateIso}`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-event-day-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-[90%]"
        style={{ direction: "rtl" }}
      >
        <h2 id="new-event-day-title" className="text-lg font-semibold mb-2">
          {t("confirmNewEventTitle")}
        </h2>
        <p className="text-sm text-neutral-600 mb-4">
          {t("confirmNewEvent", { date: displayDate })}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm border border-neutral-300 hover:bg-neutral-100"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            {tc("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
