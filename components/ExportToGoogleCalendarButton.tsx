"use client";

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { CalendarPlus, Check, Copy, Link as LinkIcon, LogIn, Printer } from "lucide-react";
import { YearCalendarGrid } from "@/components/YearCalendarGrid";
import type { CalendarMonth } from "@/lib/views/calendar";

interface ExportEventType {
  key: string;
  labelHe: string;
  colorHex: string;
}

export interface CalendarPrintOptions {
  months: CalendarMonth[];
  schoolName: string;
  yearLabel: string;
}

interface Props {
  schoolSlug?: string;
  allGrades?: number[];
  eventTypes?: ExportEventType[];
  defaultGrades?: number[];
  defaultTypes?: string[];
  buttonClassName?: string;
  labelKey?: "button" | "shortButton";
  printCalendar?: CalendarPrintOptions;
}

type ExportMode = "choices" | "google" | "print";

/** Opens a choice between a private Google Calendar subscription and a printable month. */
export function ExportToGoogleCalendarButton({
  schoolSlug: _schoolSlug,
  allGrades: _allGrades,
  eventTypes: _eventTypes,
  defaultGrades: _defaultGrades,
  defaultTypes: _defaultTypes,
  buttonClassName,
  labelKey = "button",
  printCalendar,
}: Props) {
  const t = useTranslations("export");
  const [mode, setMode] = useState<ExportMode | null>(null);
  const [printMonth, setPrintMonth] = useState<CalendarMonth | null>(null);

  function close() {
    setMode(null);
  }

  function print(monthIndex: number) {
    const month = printCalendar?.months[monthIndex];
    if (!month) return;
    flushSync(() => setPrintMonth(month));
    document.body.classList.add("printing-calendar");
    window.addEventListener("afterprint", () => document.body.classList.remove("printing-calendar"), {
      once: true,
    });
    window.print();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMode("choices")}
        className={
          buttonClassName ??
          "inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        }
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        {t(labelKey)}
      </button>
      {mode === "choices" && (
        <ExportChoiceDialog
          canPrint={Boolean(printCalendar?.months.length)}
          onClose={close}
          onGoogle={() => setMode("google")}
          onPrint={() => setMode("print")}
        />
      )}
      {mode === "google" && <GoogleCalendarDialog onClose={close} />}
      {mode === "print" && printCalendar && (
        <PrintDialog calendar={printCalendar} onClose={close} onPrint={print} />
      )}
      {printMonth && printCalendar && typeof document !== "undefined" && createPortal(
        <div className="print-calendar-sheet">
          <YearCalendarGrid
            months={[printMonth]}
            yearLabel={printCalendar.yearLabel}
            schoolName={printCalendar.schoolName}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

function ExportChoiceDialog({
  canPrint,
  onClose,
  onGoogle,
  onPrint,
}: {
  canPrint: boolean;
  onClose: () => void;
  onGoogle: () => void;
  onPrint: () => void;
}) {
  const t = useTranslations("export");
  useEscape(onClose);

  return (
    <Dialog title={t("exportTitle")} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceButton icon={<LinkIcon className="size-5" />} label={t("googleCalendar")} onClick={onGoogle} />
        {canPrint && (
          <ChoiceButton icon={<Printer className="size-5" />} label={t("printCalendar")} onClick={onPrint} />
        )}
      </div>
    </Dialog>
  );
}

function ChoiceButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-800 transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span className="text-blue-700" aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

function PrintDialog({
  calendar,
  onClose,
  onPrint,
}: {
  calendar: CalendarPrintOptions;
  onClose: () => void;
  onPrint: (monthIndex: number) => void;
}) {
  const t = useTranslations("export");
  const tm = useTranslations("months");
  const [monthIndex, setMonthIndex] = useState(0);
  useEscape(onClose);

  return (
    <Dialog title={t("printTitle")} onClose={onClose}>
      <label className="grid gap-2 text-sm font-medium text-neutral-800">
        {t("chooseMonthToPrint")}
        <select
          aria-label={t("chooseMonthToPrint")}
          value={monthIndex}
          onChange={(event) => setMonthIndex(Number(event.target.value))}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {calendar.months.map((month, index) => (
            <option key={`${month.year}-${month.monthIndex}`} value={index}>
              {tm(String(month.monthIndex) as `${number}`)} {month.year}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          {t("close")}
        </button>
        <button type="button" onClick={() => onPrint(monthIndex)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Printer className="size-4" aria-hidden="true" />
          {t("print")}
        </button>
      </div>
    </Dialog>
  );
}

function GoogleCalendarDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("export");
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose);

  async function createUrl() {
    setCreating(true);
    setError(null);
    setLoginRequired(false);
    setCopied(false);
    const res = await fetch("/api/v1/ical-subscriptions/personal", { method: "POST" });
    setCreating(false);
    if (res.status === 401) return setLoginRequired(true);
    if (!res.ok) return setError(t("errorGeneric"));
    const body = (await res.json()) as { url?: string };
    if (!body.url) return setError(t("errorGeneric"));
    setUrl(body.url);
  }

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
  }

  const loginHref = typeof window === "undefined"
    ? "/auth/login"
    : `/auth/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;

  return (
    <Dialog title={t("modalTitle")} onClose={onClose}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700"><LinkIcon className="size-5" aria-hidden="true" /></span>
        <p className="text-sm leading-6 text-neutral-600">{t("intro")}</p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm leading-6 text-neutral-700">
        <p>{t("googleInstructions")}</p>
        <p className="mt-1 text-neutral-500">{t("syncNote")}</p>
      </div>
      {url && <div className="rounded-lg border border-green-200 bg-green-50 p-3">
        <label className="mb-2 block text-sm font-medium text-green-900">{t("urlLabel")}</label>
        <div className="flex gap-2">
          <input type="text" readOnly value={url} onClick={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-green-300 bg-white px-3 py-2 text-xs text-neutral-800" />
          <button type="button" onClick={copyUrl} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>}
      {loginRequired && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="font-semibold">{t("loginRequiredTitle")}</p>
        <p className="mt-1">{t("loginRequiredBody")}</p>
        <a href={loginHref} className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"><LogIn className="size-4" aria-hidden="true" />{t("loginAction")}</a>
      </div>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">{t("close")}</button>
        {!url && <button type="button" onClick={createUrl} disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><CalendarPlus className="size-4" aria-hidden="true" />{creating ? t("creatingUrl") : t("createUrl")}</button>}
      </div>
    </Dialog>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="export-modal-title" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div onClick={(event) => event.stopPropagation()} className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-5 shadow-2xl">
      <h2 id="export-modal-title" className="text-lg font-semibold text-neutral-900">{title}</h2>
      {children}
    </div>
  </div>;
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}
