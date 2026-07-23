"use client";

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { CalendarPlus, Check, Copy, Link as LinkIcon, LogIn } from "lucide-react";
import {
  ExportChoiceDialog,
  PrintDialog,
  type CalendarPrintOptions,
  type PrintMode,
} from "@/components/CalendarPrintDialogs";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import type { CalendarMonth } from "@/lib/views/calendar";

interface ExportEventType {
  key: string;
  labelHe: string;
  colorHex: string;
}

export type { CalendarPrintOptions } from "@/components/CalendarPrintDialogs";

interface Props {
  schoolSlug?: string;
  allGrades?: number[];
  eventTypes?: ExportEventType[];
  defaultGrades?: number[];
  defaultTypes?: string[];
  buttonClassName?: string;
  labelKey?: "button" | "shortButton";
  printCalendar?: CalendarPrintOptions;
  loadPrintCalendar?: () => Promise<CalendarPrintOptions>;
}

type ExportMode = "choices" | "google" | "print";

/** Opens Google Calendar and selected-month printing export choices. */
export function ExportToGoogleCalendarButton({
  schoolSlug: _schoolSlug,
  allGrades: _allGrades,
  eventTypes: _eventTypes,
  defaultGrades: _defaultGrades,
  defaultTypes: _defaultTypes,
  buttonClassName,
  labelKey = "button",
  printCalendar,
  loadPrintCalendar,
}: Props) {
  const t = useTranslations("export");
  const [mode, setMode] = useState<ExportMode | null>(null);
  const [printMonth, setPrintMonth] = useState<CalendarMonth | null>(null);
  const [loadedPrintCalendar, setLoadedPrintCalendar] = useState<CalendarPrintOptions | null>(null);
  const activePrintCalendar = printCalendar ?? loadedPrintCalendar;

  function close() {
    setMode(null);
  }

  function print(monthIndex: number, printMode: PrintMode) {
    const month = activePrintCalendar?.months[monthIndex];
    if (!month) return;
    flushSync(() => setPrintMonth(month));
    document.body.dataset.printMode = printMode;
    window.addEventListener(
      "afterprint",
      () => {
        delete document.body.dataset.printMode;
        setPrintMonth(null);
      },
      { once: true },
    );
    window.print();
  }

  async function openPrintDialog() {
    if (printCalendar) {
      setMode("print");
      return;
    }
    if (!loadPrintCalendar) return;
    const calendar = await loadPrintCalendar();
    setLoadedPrintCalendar(calendar);
    setMode("print");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMode("choices")}
        className={
          buttonClassName ??
          "inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        }
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        {t(labelKey)}
      </button>
      {mode === "choices" && (
        <ExportChoiceDialog
          canPrint={Boolean(printCalendar?.months.length || loadPrintCalendar)}
          onClose={close}
          onGoogle={() => setMode("google")}
          onPrint={() => void openPrintDialog()}
        />
      )}
      {mode === "google" && <ExportModal onClose={close} />}
      {mode === "print" && activePrintCalendar && (
        <PrintDialog calendar={activePrintCalendar} onClose={close} onPrint={print} />
      )}
      {printMonth &&
        activePrintCalendar &&
        createPortal(
          <div className="print-calendar-sheet">
            <YearCalendarGrid
              months={[printMonth]}
              yearLabel={activePrintCalendar.yearLabel}
              schoolName={activePrintCalendar.schoolName}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function ExportModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("export");
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function createUrl() {
    setCreating(true);
    setError(null);
    setLoginRequired(false);
    setCopied(false);

    const res = await fetch("/api/v1/ical-subscriptions/personal", {
      method: "POST",
    });
    setCreating(false);

    if (res.status === 401) {
      setLoginRequired(true);
      return;
    }

    if (!res.ok) {
      setError(t("errorGeneric"));
      return;
    }

    const body = (await res.json()) as { url?: string };
    if (!body.url) {
      setError(t("errorGeneric"));
      return;
    }
    setUrl(body.url);
  }

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
  }

  function loginHref() {
    if (typeof window === "undefined") return "/auth/login";
    const next = `${window.location.pathname}${window.location.search}`;
    return `/auth/login?next=${encodeURIComponent(next)}`;
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
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <LinkIcon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="export-modal-title" className="text-lg font-semibold text-neutral-900">
              {t("modalTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">{t("intro")}</p>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm leading-6 text-neutral-700">
          <p>{t("googleInstructions")}</p>
          <p className="mt-1 text-neutral-500">{t("syncNote")}</p>
        </div>

        {url && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <label className="mb-2 block text-sm font-medium text-green-900">{t("urlLabel")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={url}
                onClick={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-green-300 bg-white px-3 py-2 text-xs text-neutral-800"
              />
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          </div>
        )}

        {loginRequired && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-semibold">{t("loginRequiredTitle")}</p>
            <p className="mt-1">{t("loginRequiredBody")}</p>
            <a
              href={loginHref()}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:outline-none"
            >
              <LogIn className="size-4" aria-hidden="true" />
              {t("loginAction")}
            </a>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            {t("close")}
          </button>
          {!url && (
            <button
              type="button"
              onClick={createUrl}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              {creating ? t("creatingUrl") : t("createUrl")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
