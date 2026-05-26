"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Clock, Search, ShieldCheck, UserCheck, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatGradeLabel } from "@/lib/grades";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

// Pinned locale + timezone so SSR (Node) and the client agree — a bare
// toLocaleString() uses each runtime's default locale and triggers a
// hydration mismatch.
const REQUESTED_AT_FMT = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  dateStyle: "short",
  timeStyle: "short",
});

interface PendingRow {
  id: string;
  email: string;
  fullName: string;
  requestedAt: Date | string;
}

interface EventTypeRow {
  key: string;
  labelHe: string;
}

export function PendingRequestsTable({
  pending,
  eventTypes,
}: {
  pending: PendingRow[];
  eventTypes: EventTypeRow[];
}) {
  const t = useTranslations("admin.staff");
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  async function approve(row: PendingRow, form: FormData) {
    if (busyId) return;
    setError(null);
    setBusyId(row.id);
    const role = String(form.get("role") ?? "viewer");
    const gradeScopes = ALL_GRADES.filter((g) => form.get(`grade-${g}`) === "on");
    const eventTypeScopes = eventTypes
      .filter((et) => form.get(`type-${et.key}`) === "on")
      .map((et) => et.key);
    try {
      const res = await fetch("/api/v1/admin/staff/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          pendingId: row.id,
          fullName: String(form.get("fullName") ?? row.fullName),
          role,
          gradeScopes,
          eventTypeScopes,
        }),
      });
      if (res.ok) {
        setActiveId(null);
        setResolvedIds((prev) => new Set(prev).add(row.id));
        startTransition(() => router.refresh());
      } else {
        setError(t("createError"));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (busyId) return;
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/v1/admin/staff/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", pendingId: id }),
      });
      if (res.ok) {
        setResolvedIds((prev) => new Set(prev).add(id));
        startTransition(() => router.refresh());
      } else {
        setError(t("createError"));
      }
    } finally {
      setBusyId(null);
    }
  }

  const visible = pending
    .filter((p) => !resolvedIds.has(p.id))
    .filter((p) =>
      `${p.email} ${p.fullName}`
        .toLocaleLowerCase("he-IL")
        .includes(query.trim().toLocaleLowerCase("he-IL")),
    );
  const activeRow = pending.find((p) => p.id === activeId) ?? null;

  if (pending.filter((p) => !resolvedIds.has(p.id)).length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
        {t("noPendingRequests")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 bg-amber-50/60 p-4">
        <label className="relative block max-w-lg">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPending")}
            aria-label={t("searchPending")}
            className="h-10 w-full rounded-md border border-neutral-300 bg-white ps-10 pe-3 text-sm transition outline-none focus:border-neutral-900 focus:ring-3 focus:ring-neutral-200"
          />
        </label>
      </div>

      <div className="max-h-[520px] divide-y divide-neutral-100 overflow-y-auto">
        {visible.map((row) => (
          <div
            key={row.id}
            className="grid gap-3 p-4 transition hover:bg-neutral-50 lg:grid-cols-[1fr_auto] lg:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-neutral-950">{row.fullName}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {t("pending")}
                </span>
              </div>
              <div className="mt-1 text-sm break-all text-neutral-600">{row.email}</div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                <Clock className="size-3.5" />
                {REQUESTED_AT_FMT.format(new Date(row.requestedAt))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setActiveId(row.id)}
                disabled={busyId !== null || isPending}
              >
                {t("approve")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => reject(row.id)}
                disabled={busyId !== null || isPending}
              >
                {busyId === row.id ? `${t("reject")}…` : t("reject")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-neutral-500">
          {t("noPendingMatches")}
        </div>
      )}

      {activeRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-pending-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setActiveId(null)}
        >
          <form
            action={(form) => {
              void approve(activeRow, form);
            }}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl"
          >
            <input type="hidden" name="pendingId" value={activeRow.id} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="approve-pending-title" className="text-lg font-semibold text-neutral-950">
                  {t("approveUserTitle")}
                </h3>
                <p className="mt-1 text-sm break-all text-neutral-600">{activeRow.email}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setActiveId(null)}
                aria-label={t("cancel")}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-neutral-700">{t("fullName")}</span>
                <input
                  name="fullName"
                  defaultValue={activeRow.fullName}
                  className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900 focus:ring-3 focus:ring-neutral-200"
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-neutral-700">{t("role")}</span>
                <select
                  name="role"
                  defaultValue="viewer"
                  className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900 focus:ring-3 focus:ring-neutral-200"
                >
                  <option value="viewer">{t("roleViewer")}</option>
                  <option value="editor">{t("roleEditor")}</option>
                  <option value="admin">{t("roleAdmin")}</option>
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <fieldset className="rounded-lg border border-neutral-200 p-3">
                <legend className="px-1 text-sm font-medium text-neutral-800">
                  {t("gradeScopes")}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL_GRADES.map((g) => (
                    <label
                      key={g}
                      className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
                    >
                      <input type="checkbox" name={`grade-${g}`} /> {formatGradeLabel(g)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="rounded-lg border border-neutral-200 p-3">
                <legend className="px-1 text-sm font-medium text-neutral-800">
                  {t("eventTypeScopes")}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {eventTypes.map((et) => (
                    <label
                      key={et.key}
                      className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
                    >
                      <input type="checkbox" name={`type-${et.key}`} /> {et.labelHe}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-5 grid gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700 sm:grid-cols-3">
              <ModalHint icon={<Users className="size-4" />} text={t("viewerHint")} />
              <ModalHint icon={<UserCheck className="size-4" />} text={t("editorHint")} />
              <ModalHint icon={<ShieldCheck className="size-4" />} text={t("adminHint")} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busyId !== null || isPending}>
                {busyId === activeId ? `${t("approve")}…` : t("approve")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActiveId(null)}
                disabled={busyId !== null || isPending}
              >
                {t("cancel")}
              </Button>
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ModalHint({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
