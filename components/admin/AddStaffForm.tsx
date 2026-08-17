"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouteProgress } from "@/components/RouteProgress";
import { ALL_GRADES, ScopeFields } from "@/components/admin/ScopeFields";

interface EventTypeRow {
  key: string;
  labelHe: string;
}

interface CreatedStaff {
  email: string;
  temporaryPassword: string;
}

export function AddStaffForm({ eventTypes }: { eventTypes: EventTypeRow[] }) {
  const t = useTranslations("admin.staff");
  const tc = useTranslations("common");
  const router = useRouter();
  const startRouteProgress = useRouteProgress();
  const [role, setRole] = useState<string>("editor");
  const [created, setCreated] = useState<CreatedStaff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formKey, setFormKey] = useState(0);

  async function create(form: FormData) {
    setError(null);
    setCreated(null);
    setCopied(false);
    const selectedRole = String(form.get("role") ?? "editor");
    const gradeScopes =
      selectedRole === "editor"
        ? ALL_GRADES.filter((g) => form.get(`add-staff-grade-${g}`) === "on")
        : [];
    const eventTypeScopes =
      selectedRole === "editor"
        ? eventTypes
            .filter((et) => form.get(`add-staff-type-${et.key}`) === "on")
            .map((et) => et.key)
        : [];
    const body = {
      email: String(form.get("email") ?? "").trim(),
      fullName: String(form.get("fullName") ?? "").trim(),
      role: selectedRole,
      gradeScopes,
      eventTypeScopes,
    };

    const res = await fetch("/api/v1/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error === "duplicate_email" ? t("duplicateEmail") : t("createError"));
      return;
    }
    const data = (await res.json()) as { email: string; temporaryPassword: string };
    setCreated({ email: data.email, temporaryPassword: data.temporaryPassword });
    setFormKey((k) => k + 1);
    setRole("editor");
    startRouteProgress(2500);
    router.refresh();
  }

  function copyPassword(password: string) {
    void navigator.clipboard
      .writeText(password)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setError(t("copyPasswordError"));
      });
  }

  return (
    <form
      key={formKey}
      action={create}
      data-testid="add-staff-form"
      className="space-y-3 rounded border p-3"
    >
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
          required
          placeholder={t("email")}
          className="w-56 rounded border px-2 py-1"
          aria-label={t("email")}
        />
        <input
          name="fullName"
          type="text"
          required
          placeholder={t("fullName")}
          className="w-56 rounded border px-2 py-1"
          aria-label={t("fullName")}
        />
        <AddStaffSubmitButton label={t("create")} loadingLabel={tc("saving")} />
      </div>

      {role === "editor" && (
        <ScopeFields
          eventTypes={eventTypes}
          gradeName={(grade) => `add-staff-grade-${grade}`}
          typeName={(key) => `add-staff-type-${key}`}
          labels={{
            gradeScopes: t("gradeScopes"),
            eventTypeScopes: t("eventTypeScopes"),
            selectAllGrades: t("selectAllGrades"),
            clearAllGrades: t("clearAllGrades"),
            selectAllEventTypes: t("selectAllEventTypes"),
            clearAllEventTypes: t("clearAllEventTypes"),
          }}
          wrapperClassName="lg:grid-cols-1 xl:grid-cols-2"
          legendClassName="text-neutral-950"
          optionClassName="rounded-none border-0 px-0 py-0"
        />
      )}

      {created && (
        <div
          data-testid="temp-password-panel"
          className="space-y-1 rounded border border-green-200 bg-green-50 p-3"
        >
          <p className="text-sm font-medium text-green-800">
            {t("staffCreated")}: {created.email}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-700">
              {t("temporaryPassword")}:{" "}
              <code className="rounded bg-white px-2 py-0.5 font-mono">
                {created.temporaryPassword}
              </code>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copyPassword(created.temporaryPassword)}
            >
              {copied ? t("passwordCopied") : t("copyPassword")}
            </Button>
          </div>
          <p className="text-xs text-neutral-600">
            {t("tempPasswordWarning", { email: created.email })}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

function AddStaffSubmitButton({
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
