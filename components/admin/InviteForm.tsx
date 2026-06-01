"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatGradeLabel } from "@/lib/grades";
import { useRouteProgress } from "@/components/RouteProgress";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

interface EventTypeRow {
  key: string;
  labelHe: string;
}

export function InviteForm({ eventTypes }: { eventTypes: EventTypeRow[] }) {
  const t = useTranslations("admin.staff");
  const tc = useTranslations("common");
  const router = useRouter();
  const startRouteProgress = useRouteProgress();
  const [role, setRole] = useState<string>("editor");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formKey, setFormKey] = useState(0);

  async function create(form: FormData) {
    setError(null);
    setUrl(null);
    setEmailSent(false);
    setCopied(false);
    const selectedRole = String(form.get("role") ?? "editor");
    const gradeScopes =
      selectedRole === "editor"
        ? ALL_GRADES.filter((g) => form.get(`invite-grade-${g}`) === "on")
        : [];
    const eventTypeScopes =
      selectedRole === "editor"
        ? eventTypes
            .filter((et) => form.get(`invite-type-${et.key}`) === "on")
            .map((et) => et.key)
        : [];
    const emailRaw = String(form.get("email") ?? "").trim();
    const body: Record<string, unknown> = {
      role: selectedRole,
      expiresInHours: Number(form.get("expiresInHours") ?? 72),
      gradeScopes,
      eventTypeScopes,
      multiUse: form.get("multiUse") === "on",
    };
    if (emailRaw) body.email = emailRaw;
    const res = await fetch("/api/v1/admin/staff/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(t("createError"));
      return;
    }
    const data = (await res.json()) as { url: string; emailSent: boolean };
    setUrl(data.url);
    setEmailSent(data.emailSent);
    setFormKey((k) => k + 1);
    startRouteProgress(2500);
    router.refresh();
  }

  function copyUrl(inviteUrl: string) {
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <form key={formKey} action={create} className="space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="role"
          defaultValue="editor"
          className="rounded border px-2 py-1"
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="viewer">{t("roleViewer")}</option>
          <option value="editor">{t("roleEditor")}</option>
          <option value="admin">{t("roleAdmin")}</option>
        </select>
        <input
          name="email"
          type="email"
          placeholder={t("email")}
          className="w-56 rounded border px-2 py-1"
          aria-label={t("email")}
        />
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <span>{t("expiresInHours")}</span>
          <input
            name="expiresInHours"
            type="number"
            defaultValue={72}
            min={1}
            max={720}
            className="w-24 rounded border px-2 py-1 text-base font-normal text-neutral-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="multiUse" />
          {t("multiUse")}
        </label>
        <InviteSubmitButton label={t("createInvite")} loadingLabel={tc("saving")} />
      </div>

      {role === "editor" && (
        <>
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
        </>
      )}

      {url && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-all text-sm text-green-700">
            {t("inviteCreated")}: {url}
            {emailSent && <span className="ml-2">· {t("emailSent")}</span>}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => copyUrl(url)}
          >
            {copied ? t("inviteCopied") : t("copyInvite")}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

function InviteSubmitButton({
  label,
  loadingLabel,
}: {
  label: string;
  loadingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? loadingLabel : label}
    </Button>
  );
}
