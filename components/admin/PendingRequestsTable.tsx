"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatGradeLabel } from "@/lib/grades";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

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

  async function approve(row: PendingRow, form: FormData) {
    setError(null);
    const role = String(form.get("role") ?? "viewer");
    const gradeScopes = ALL_GRADES.filter((g) => form.get(`grade-${g}`) === "on");
    const eventTypeScopes = eventTypes
      .filter((et) => form.get(`type-${et.key}`) === "on")
      .map((et) => et.key);
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
      router.refresh();
    } else {
      setError(t("createError"));
    }
  }

  async function reject(id: string) {
    const res = await fetch("/api/v1/admin/staff/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", pendingId: id }),
    });
    if (res.ok) router.refresh();
  }

  if (pending.length === 0) {
    return <p className="text-sm text-neutral-500">{t("noPendingRequests")}</p>;
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pe-4 text-start">{t("email")}</th>
            <th className="py-2 pe-4 text-start">{t("fullName")}</th>
            <th className="py-2 pe-4 text-start">{t("requestedAt")}</th>
            <th className="py-2 text-start"></th>
          </tr>
        </thead>
        <tbody>
          {pending.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-2 pe-4">{row.email}</td>
              <td className="py-2 pe-4">{row.fullName}</td>
              <td className="py-2 pe-4">{new Date(row.requestedAt).toLocaleString()}</td>
              <td className="flex gap-2 py-2">
                <Button size="sm" onClick={() => setActiveId(row.id)}>
                  {t("approve")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => reject(row.id)}>
                  {t("reject")}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeId && (
        <form
          action={(form) => {
            const row = pending.find((p) => p.id === activeId);
            if (row) void approve(row, form);
          }}
          className="space-y-3 rounded border p-3"
        >
          <input type="hidden" name="pendingId" value={activeId} />
          <input
            name="fullName"
            defaultValue={pending.find((p) => p.id === activeId)?.fullName}
            className="block w-full rounded border px-2 py-1"
            required
          />
          <select name="role" defaultValue="viewer" className="block rounded border px-2 py-1">
            <option value="viewer">{t("roleViewer")}</option>
            <option value="editor">{t("roleEditor")}</option>
            <option value="admin">{t("roleAdmin")}</option>
          </select>
          <fieldset>
            <legend className="text-sm font-medium">{t("gradeScopes")}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {ALL_GRADES.map((g) => (
                <label key={g} className="flex items-center gap-1">
                  <input type="checkbox" name={`grade-${g}`} /> {formatGradeLabel(g)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">{t("eventTypeScopes")}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {eventTypes.map((et) => (
                <label key={et.key} className="flex items-center gap-1">
                  <input type="checkbox" name={`type-${et.key}`} /> {et.labelHe}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-3">
            <Button type="submit">{t("approve")}</Button>
            <Button type="button" variant="ghost" onClick={() => setActiveId(null)}>
              {t("cancel")}
            </Button>
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
