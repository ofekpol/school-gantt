"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatGradeLabel } from "@/lib/grades";
import { useRouteProgress } from "@/components/RouteProgress";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

interface StaffRow {
  id: string;
  email: string;
  fullName: string;
  role: "editor" | "admin" | "viewer";
  deactivatedAt: Date | string | null;
  gradeScopes: number[];
  eventTypeScopes: string[];
}

interface EventTypeRow {
  id: string;
  key: string;
  labelHe: string;
  labelEn: string;
}

interface Props {
  initialStaff: StaffRow[];
  eventTypes: EventTypeRow[];
}

export function StaffTable({ initialStaff, eventTypes }: Props) {
  const t = useTranslations("admin.staff");
  const tc = useTranslations("common");
  const router = useRouter();
  const startRouteProgress = useRouteProgress();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDeactivate(id: string, deactivated: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/v1/admin/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deactivated }),
    });
    setBusyId(null);
    if (res.ok) {
      startRouteProgress(2500);
      router.refresh();
    }
  }

  async function handleSave(row: StaffRow, form: FormData) {
    setError(null);
    setBusyId(row.id);
    const role = String(form.get("role") ?? row.role);
    const gradeScopes = ALL_GRADES.filter((g) => form.get(`staff-grade-${row.id}-${g}`) === "on");
    const eventTypeScopes = eventTypes
      .filter((et) => form.get(`staff-type-${row.id}-${et.key}`) === "on")
      .map((et) => et.key);
    const res = await fetch(`/api/v1/admin/staff/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: String(form.get("fullName") ?? row.fullName).trim(),
        role,
        gradeScopes,
        eventTypeScopes,
      }),
    });
    setBusyId(null);
    if (res.ok) {
      setEditingId(null);
      startRouteProgress(2500);
      router.refresh();
      return;
    }
    setError(t("createError"));
  }

  function roleLabel(role: StaffRow["role"]) {
    if (role === "admin") return t("roleAdmin");
    if (role === "viewer") return t("roleViewer");
    return t("roleEditor");
  }

  function scopeLabel(row: StaffRow) {
    if (row.role === "admin") return t("roleAdmin");
    if (row.role === "viewer") return t("roleViewer");
    const grades = row.gradeScopes.map(formatGradeLabel);
    const types = eventTypes
      .filter((et) => row.eventTypeScopes.includes(et.key))
      .map((et) => et.labelHe);
    return [...grades, ...types].join(", ") || "—";
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-start py-2 pe-4">{t("email")}</th>
            <th className="text-start py-2 pe-4">{t("fullName")}</th>
            <th className="text-start py-2 pe-4">{t("role")}</th>
            <th className="text-start py-2 pe-4">{t("scopes")}</th>
            <th className="text-start py-2"></th>
          </tr>
        </thead>
        <tbody>
          {initialStaff.map((s) => (
            <Fragment key={s.id}>
              <tr className="border-t">
                <td className="py-2 pe-4">{s.email}</td>
                <td className="py-2 pe-4">{s.fullName}</td>
                <td className="py-2 pe-4">{roleLabel(s.role)}</td>
                <td className="py-2 pe-4">{scopeLabel(s)}</td>
                <td className="flex gap-2 py-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(s.id)} disabled={busyId !== null}>
                    {t("edit")}
                  </Button>
                  {s.deactivatedAt ? (
                    <Button variant="ghost" size="sm" onClick={() => handleDeactivate(s.id, false)} disabled={busyId !== null}>
                      {busyId === s.id ? tc("loading") : `${t("deactivated")} x`}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleDeactivate(s.id, true)} disabled={busyId !== null}>
                      {busyId === s.id ? tc("loading") : t("deactivate")}
                    </Button>
                  )}
                </td>
              </tr>
              {editingId === s.id && (
                <tr className="border-t bg-neutral-50">
                  <td colSpan={5} className="py-3">
                    <form
                      action={(form) => {
                        void handleSave(s, form);
                      }}
                      className="space-y-3 rounded border bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          name="fullName"
                          defaultValue={s.fullName}
                          aria-label={t("fullName")}
                          className="w-64 rounded border px-2 py-1"
                          required
                        />
                        <select name="role" defaultValue={s.role} className="rounded border px-2 py-1">
                          <option value="viewer">{t("roleViewer")}</option>
                          <option value="editor">{t("roleEditor")}</option>
                          <option value="admin">{t("roleAdmin")}</option>
                        </select>
                      </div>
                      <fieldset>
                        <legend className="text-sm font-medium">{t("gradeScopes")}</legend>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {ALL_GRADES.map((g) => (
                            <label key={g} className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                name={`staff-grade-${s.id}-${g}`}
                                defaultChecked={s.gradeScopes.includes(g)}
                              />{" "}
                              {formatGradeLabel(g)}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset>
                        <legend className="text-sm font-medium">{t("eventTypeScopes")}</legend>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {eventTypes.map((et) => (
                            <label key={et.key} className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                name={`staff-type-${s.id}-${et.key}`}
                                defaultChecked={s.eventTypeScopes.includes(et.key)}
                              />{" "}
                              {et.labelHe}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={busyId === s.id}>
                          {busyId === s.id ? tc("saving") : t("save")}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setEditingId(null)} disabled={busyId === s.id}>
                          {t("cancel")}
                        </Button>
                        {error && <span className="text-sm text-red-500">{error}</span>}
                      </div>
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
