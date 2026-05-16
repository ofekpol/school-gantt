"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatGradeList } from "@/lib/grades";

export interface QueueItem {
  id: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string;
  parentEventId: string | null;
  submittedAt: Date | string;
  submitterName: string;
  eventTypeKey: string;
  eventTypeLabelHe: string;
  eventTypeColor: string;
  grades: number[];
}

interface Props {
  initial: QueueItem[];
}

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  dateStyle: "medium",
});

const dateTimeFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  dateStyle: "short",
  timeStyle: "short",
});

export function QueueTable({ initial }: Props) {
  const t = useTranslations("admin.queue");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/v1/events/${id}/approve`, { method: "POST" });
    setBusyId(null);
    if (res.ok) router.refresh();
    else setError(t("errorGeneric"));
  }

  async function handleRejectConfirm() {
    if (!rejectId) return;
    if (reason.trim().length === 0) {
      setError(t("errorRequired"));
      return;
    }
    setError(null);
    setBusyId(rejectId);
    const res = await fetch(`/api/v1/events/${rejectId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setBusyId(null);
    if (res.ok) {
      setRejectId(null);
      setReason("");
      router.refresh();
    } else {
      setError(t("errorGeneric"));
    }
  }

  if (initial.length === 0) {
    return <p className="text-neutral-500">{t("empty")}</p>;
  }

  return (
    <div>
      <ul className="space-y-3">
        {initial.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-neutral-200 p-4 flex items-start justify-between gap-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block size-3 rounded-full border border-neutral-300"
                  style={{ backgroundColor: item.eventTypeColor }}
                  aria-hidden="true"
                />
                <span className="text-sm text-neutral-500">
                  {item.eventTypeLabelHe}
                </span>
                {item.parentEventId && (
                  <span className="text-xs rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                    {t("isRevision")}
                  </span>
                )}
              </div>
              <p className="font-medium">{item.title || "(ללא שם)"}</p>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-neutral-600">
                <dt className="font-medium">{t("startAt")}</dt>
                <dd>{dateFmt.format(new Date(item.startAt))}</dd>
                <dt className="font-medium">{t("grades")}</dt>
                <dd>{formatGradeList(item.grades) || "—"}</dd>
                <dt className="font-medium">{t("submittedBy")}</dt>
                <dd>{item.submitterName || "—"}</dd>
                <dt className="font-medium">{t("submittedAt")}</dt>
                <dd>{dateTimeFmt.format(new Date(item.submittedAt))}</dd>
              </dl>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                onClick={() => handleApprove(item.id)}
                disabled={busyId === item.id}
                size="sm"
              >
                {t("approve")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRejectId(item.id);
                  setReason("");
                  setError(null);
                }}
                disabled={busyId === item.id}
              >
                {t("reject")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {rejectId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 id="reject-title" className="text-lg font-semibold mb-3">
              {t("rejectTitle")}
            </h2>
            <label className="block text-sm font-medium mb-1" htmlFor="reject-reason">
              {t("rejectReasonLabel")}
            </label>
            <textarea
              id="reject-reason"
              className="w-full rounded border border-neutral-300 p-2 text-sm"
              rows={4}
              placeholder={t("rejectReasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            {error && (
              <p role="alert" className="text-sm text-red-600 mt-1">
                {error}
              </p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setRejectId(null);
                  setReason("");
                  setError(null);
                }}
                disabled={busyId === rejectId}
              >
                {t("cancel")}
              </Button>
              <Button onClick={handleRejectConfirm} disabled={busyId === rejectId}>
                {t("rejectConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
