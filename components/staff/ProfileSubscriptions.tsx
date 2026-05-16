"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatGradeLabel, formatGradeList } from "@/lib/grades";

interface Subscription {
  id: string;
  token: string;
  filterGrades: number[];
  filterEventTypes: string[];
  createdAt: string;
  revokedAt: string | null;
}

interface EventTypeOption {
  id: string;
  labelHe: string;
  colorHex: string;
}

interface Props {
  initial: Subscription[];
  eventTypes: EventTypeOption[];
}

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  dateStyle: "medium",
});

export function ProfileSubscriptions({ initial, eventTypes }: Props) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<Set<number>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The token returned by POST is the only time we see it in cleartext;
  // surface it here until the user clicks "done".
  const [freshToken, setFreshToken] = useState<{ id: string; token: string } | null>(null);
  // Optimistically removed subscription IDs so the row disappears immediately on revoke.
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());

  function toggle<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/ical-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grades: Array.from(selectedGrades),
        eventTypes: Array.from(selectedTypes),
      }),
    });
    setBusy(false);
    if (res.status === 201) {
      const json = (await res.json()) as { id: string; token: string };
      setFreshToken(json);
      setSelectedGrades(new Set());
      setSelectedTypes(new Set());
      setCreating(false);
      router.refresh();
    } else {
      setError(t("errorGeneric"));
    }
  }

  async function handleRevoke(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/ical-subscriptions/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) {
      // Optimistically remove the row immediately so the UI updates without
      // waiting for the Next.js router.refresh() round-trip.
      setRevokedIds((prev) => new Set(prev).add(id));
      router.refresh();
    } else {
      setError(t("errorGeneric"));
    }
  }

  function urlFor(token: string): string {
    if (typeof window === "undefined") return `/ical/${token}`;
    return `${window.location.origin}/ical/${token}`;
  }

  const active = initial.filter((s) => s.revokedAt === null && !revokedIds.has(s.id));

  return (
    <div>
      {freshToken && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-900 mb-1">{t("freshTokenTitle")}</p>
          <p className="text-green-800 mb-2">{t("freshTokenHint")}</p>
          <input
            type="text"
            readOnly
            value={urlFor(freshToken.token)}
            onClick={(e) => e.currentTarget.select()}
            className="w-full rounded border border-green-300 bg-white px-2 py-1 text-xs"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setFreshToken(null)}>
              {t("done")}
            </Button>
          </div>
        </div>
      )}

      {creating ? (
        <div className="mb-4 rounded-md border border-neutral-200 p-3">
          <fieldset className="mb-3">
            <legend className="text-sm font-medium mb-1">{t("grades")}</legend>
            <div className="flex flex-wrap gap-2">
              {ALL_GRADES.map((g) => {
                const on = selectedGrades.has(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGrades(toggle(selectedGrades, g))}
                    aria-pressed={on}
                    className={`min-h-11 min-w-11 rounded-full border px-3 py-1 text-sm ${
                      on
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-neutral-300 text-neutral-700"
                    }`}
                  >
                    {formatGradeLabel(g)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="mb-3">
            <legend className="text-sm font-medium mb-1">{t("types")}</legend>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((et) => {
                const on = selectedTypes.has(et.id);
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() => setSelectedTypes(toggle(selectedTypes, et.id))}
                    aria-pressed={on}
                    className={`min-h-11 rounded-full border px-3 py-1 text-sm flex items-center gap-2 ${
                      on
                        ? "bg-neutral-900 border-neutral-900 text-white"
                        : "bg-white border-neutral-300 text-neutral-700"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: et.colorHex }}
                    />
                    {et.labelHe}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className="text-xs text-neutral-500 mb-3">{t("emptyMeansAll")}</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={busy}>
              {t("create")}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
      ) : (
        <Button onClick={() => setCreating(true)} className="mb-4">
          {t("create")}
        </Button>
      )}

      {active.length === 0 ? (
        <p className="text-neutral-500 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {active.map((sub) => (
            <li
              key={sub.id}
              className="rounded-md border border-neutral-200 p-3 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-500 mb-1">
                  {t("createdAt")}: {dateFmt.format(new Date(sub.createdAt))}
                </p>
                <input
                  type="text"
                  readOnly
                  value={urlFor(sub.token)}
                  onClick={(e) => e.currentTarget.select()}
                  className="w-full rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs font-mono"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  {sub.filterGrades.length === 0 && sub.filterEventTypes.length === 0
                    ? t("filterNone")
                    : t("filterSummary", {
                        grades: formatGradeList(sub.filterGrades) || "—",
                        types: String(sub.filterEventTypes.length),
                      })}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRevoke(sub.id)}
                disabled={busy}
              >
                {t("revoke")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && !creating && (
        <p role="alert" className="text-sm text-red-600 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
