"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatGradeLabel } from "@/lib/grades";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

interface EventTypeRow {
  key: string;
  labelHe: string;
}

export function InviteForm({ eventTypes }: { eventTypes: EventTypeRow[] }) {
  const t = useTranslations("admin.staff");
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(form: FormData) {
    setError(null);
    setUrl(null);
    const gradeScopes = ALL_GRADES.filter((g) => form.get(`invite-grade-${g}`) === "on");
    const eventTypeScopes = eventTypes
      .filter((et) => form.get(`invite-type-${et.key}`) === "on")
      .map((et) => et.key);
    const res = await fetch("/api/v1/admin/staff/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: String(form.get("role") ?? "viewer"),
        expiresInHours: Number(form.get("expiresInHours") ?? 72),
        gradeScopes,
        eventTypeScopes,
      }),
    });
    if (!res.ok) {
      setError(t("createError"));
      return;
    }
    const data = (await res.json()) as { url: string };
    setUrl(data.url);
    router.refresh();
  }

  return (
    <form action={create} className="space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <select name="role" defaultValue="viewer" className="rounded border px-2 py-1">
          <option value="viewer">{t("roleViewer")}</option>
          <option value="editor">{t("roleEditor")}</option>
          <option value="admin">{t("roleAdmin")}</option>
        </select>
        <input
          name="expiresInHours"
          type="number"
          defaultValue={72}
          min={1}
          max={720}
          className="w-28 rounded border px-2 py-1"
          aria-label={t("expiresInHours")}
        />
        <Button type="submit">{t("createInvite")}</Button>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">{t("gradeScopes")}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {ALL_GRADES.map((g) => (
            <label key={g} className="flex items-center gap-1">
              <input type="checkbox" name={`invite-grade-${g}`} /> {formatGradeLabel(g)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">{t("eventTypeScopes")}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {eventTypes.map((et) => (
            <label key={et.key} className="flex items-center gap-1">
              <input type="checkbox" name={`invite-type-${et.key}`} /> {et.labelHe}
            </label>
          ))}
        </div>
      </fieldset>
      {url && (
        <p className="break-all text-sm text-green-700">
          {t("inviteCreated")}: {url}
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
