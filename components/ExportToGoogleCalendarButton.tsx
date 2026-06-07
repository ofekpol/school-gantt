"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, Check, Copy, Link as LinkIcon, LogIn } from "lucide-react";

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
  schoolSlug: _schoolSlug,
  allGrades: _allGrades,
  eventTypes: _eventTypes,
  defaultGrades: _defaultGrades,
  defaultTypes: _defaultTypes,
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
      {open && <ExportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportModal({
  onClose,
}: { onClose: () => void }) {
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
            <label className="mb-2 block text-sm font-medium text-green-900">
              {t("urlLabel")}
            </label>
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
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
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
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
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
