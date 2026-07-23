"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link as LinkIcon, Printer } from "lucide-react";
import type { CalendarMonth } from "@/lib/views/calendar";

export interface CalendarPrintOptions {
  months: CalendarMonth[];
  schoolName: string;
  yearLabel: string;
  defaultMonthIndex?: number;
}

export type PrintMode = "color" | "monochrome";

export function ExportChoiceDialog({
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

  return (
    <Dialog title={t("exportTitle")} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceButton
          icon={<LinkIcon className="size-5" />}
          label={t("googleCalendar")}
          onClick={onGoogle}
        />
        {canPrint && (
          <ChoiceButton
            icon={<Printer className="size-5" />}
            label={t("printCalendar")}
            onClick={onPrint}
          />
        )}
      </div>
    </Dialog>
  );
}

export function PrintDialog({
  calendar,
  onClose,
  onPrint,
}: {
  calendar: CalendarPrintOptions;
  onClose: () => void;
  onPrint: (monthIndex: number, mode: PrintMode) => void;
}) {
  const t = useTranslations("export");
  const tm = useTranslations("months");
  const [monthIndex, setMonthIndex] = useState(
    clampMonthIndex(calendar.defaultMonthIndex, calendar.months.length),
  );
  const [printMode, setPrintMode] = useState<PrintMode>("color");

  return (
    <Dialog title={t("printTitle")} onClose={onClose}>
      <label className="grid gap-2 text-sm font-medium text-neutral-800">
        {t("chooseMonthToPrint")}
        <select
          aria-label={t("chooseMonthToPrint")}
          value={monthIndex}
          onChange={(event) => setMonthIndex(Number(event.target.value))}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {calendar.months.map((month, index) => (
            <option key={`${month.year}-${month.monthIndex}`} value={index}>
              {tm(String(month.monthIndex) as `${number}`)} {month.year}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-neutral-800">{t("printMode")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <PrintModeOption
            checked={printMode === "color"}
            label={t("color")}
            onChange={() => setPrintMode("color")}
            value="color"
          />
          <PrintModeOption
            checked={printMode === "monochrome"}
            label={t("blackAndWhite")}
            onChange={() => setPrintMode("monochrome")}
            value="monochrome"
          />
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          {t("close")}
        </button>
        <button
          type="button"
          onClick={() => onPrint(monthIndex, printMode)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          <Printer className="size-4" aria-hidden="true" />
          {t("print")}
        </button>
      </div>
    </Dialog>
  );
}

function ChoiceButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-800 transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
    >
      <span className="text-blue-700" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
}

function PrintModeOption({
  checked,
  label,
  onChange,
  value,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  value: PrintMode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
      <input type="radio" name="print-mode" value={value} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEscape(onClose);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-5 shadow-2xl"
      >
        <h2 id="export-modal-title" className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function clampMonthIndex(index: number | undefined, count: number) {
  return Math.min(Math.max(index ?? 0, 0), Math.max(count - 1, 0));
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}
