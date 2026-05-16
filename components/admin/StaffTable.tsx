"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface StaffRow {
  id: string;
  email: string;
  fullName: string;
  role: "editor" | "admin" | "viewer";
  deactivatedAt: Date | string | null;
}

interface EventTypeRow {
  id: string;
  labelHe: string;
  labelEn: string;
}

interface Props {
  initialStaff: StaffRow[];
  eventTypes: EventTypeRow[];
}

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

export function StaffTable({ initialStaff }: Props) {
  const t = useTranslations("admin.staff");
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(form: FormData) {
    setCreating(true);
    setError(null);
    const grades = ALL_GRADES.filter((g) => form.get(`grade-${g}`) === "on");
    const body = {
      email: String(form.get("email") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
      role: String(form.get("role") ?? "editor"),
      temporaryPassword: String(form.get("temporaryPassword") ?? ""),
      gradeScopes: grades,
      eventTypeScopes: [],
    };
    const res = await fetch("/api/v1/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setCreating(false);
    if (res.status === 201) {
      setShowCreate(false);
      router.refresh();
    } else if (res.status === 409) {
      setError(t("duplicateEmail"));
    } else {
      setError(t("createError"));
    }
  }

  async function handleDeactivate(id: string, deactivated: boolean) {
    const res = await fetch(`/api/v1/admin/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deactivated }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <Button onClick={() => setShowCreate((s) => !s)} className="mb-4">
        {t("create")}
      </Button>
      {showCreate && (
        <form action={handleCreate} className="border rounded p-3 mb-4 space-y-2">
          <input
            name="email"
            type="email"
            placeholder={t("email")}
            required
            className="block w-full border rounded px-2 py-1"
          />
          <input
            name="fullName"
            placeholder={t("fullName")}
            required
            className="block w-full border rounded px-2 py-1"
          />
          <select name="role" defaultValue="editor" className="block border rounded px-2 py-1">
            <option value="editor">{t("roleEditor")}</option>
            <option value="admin">{t("roleAdmin")}</option>
          </select>
          <input
            name="temporaryPassword"
            type="text"
            placeholder={t("temporaryPassword")}
            required
            minLength={8}
            className="block w-full border rounded px-2 py-1"
          />
          <fieldset>
            <legend className="text-sm font-medium">{t("gradeScopes")}</legend>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_GRADES.map((g) => (
                <label key={g} className="flex items-center gap-1">
                  <input type="checkbox" name={`grade-${g}`} /> {g}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={creating}>
              {t("create")}
            </Button>
            {error && (
              <span role="alert" className="text-red-500 text-sm">
                {error}
              </span>
            )}
          </div>
        </form>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-start py-2 pe-4">{t("email")}</th>
            <th className="text-start py-2 pe-4">{t("fullName")}</th>
            <th className="text-start py-2 pe-4">{t("role")}</th>
            <th className="text-start py-2"></th>
          </tr>
        </thead>
        <tbody>
          {initialStaff.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="py-2 pe-4">{s.email}</td>
              <td className="py-2 pe-4">{s.fullName}</td>
              <td className="py-2 pe-4">
                {s.role === "admin" ? t("roleAdmin") : t("roleEditor")}
              </td>
              <td className="py-2">
                {s.deactivatedAt ? (
                  <Button variant="ghost" size="sm" onClick={() => handleDeactivate(s.id, false)}>
                    {t("deactivated")} ✕
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => handleDeactivate(s.id, true)}>
                    {t("deactivate")}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
