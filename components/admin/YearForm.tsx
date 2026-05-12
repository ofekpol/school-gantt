"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface YearRow {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface Props {
  initial: YearRow[];
  activeId: string | null;
}

interface CreateForm {
  label: string;
  startDate: string;
  endDate: string;
  setActive: boolean;
}

const EMPTY_FORM: CreateForm = {
  label: "",
  startDate: "",
  endDate: "",
  setActive: false,
};

export function YearForm({ initial, activeId }: Props) {
  const t = useTranslations("admin.year");
  const router = useRouter();
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/v1/admin/years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (res.status === 201) {
      setForm(EMPTY_FORM);
      router.refresh();
    } else {
      setError("Error creating year");
    }
  }

  async function handleSetActive(id: string) {
    const res = await fetch(`/api/v1/admin/years/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setActive: true }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b">
            <th className="text-start py-2 pe-4">{t("label")}</th>
            <th className="text-start py-2 pe-4">{t("startDate")}</th>
            <th className="text-start py-2 pe-4">{t("endDate")}</th>
            <th className="text-start py-2"></th>
          </tr>
        </thead>
        <tbody>
          {initial.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-2 pe-4">
                {row.label}
                {row.id === activeId && (
                  <span className="ms-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    {t("active")}
                  </span>
                )}
              </td>
              <td className="py-2 pe-4">{row.startDate}</td>
              <td className="py-2 pe-4">{row.endDate}</td>
              <td className="py-2">
                {row.id !== activeId && (
                  <Button size="sm" variant="ghost" onClick={() => handleSetActive(row.id)}>
                    {t("setActive")}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={handleCreate} className="border rounded p-4 space-y-3 max-w-md">
        <h2 className="font-medium">{t("create")}</h2>
        <input
          name="label"
          placeholder={t("label")}
          required
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="block w-full border rounded px-2 py-1"
        />
        <input
          name="startDate"
          type="date"
          required
          value={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          className="block w-full border rounded px-2 py-1"
        />
        <input
          name="endDate"
          type="date"
          required
          value={form.endDate}
          onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          className="block w-full border rounded px-2 py-1"
        />
        <label className="flex items-center gap-2">
          <input
            name="setActive"
            type="checkbox"
            checked={form.setActive}
            onChange={(e) => setForm((f) => ({ ...f, setActive: e.target.checked }))}
          />
          {t("setActive")}
        </label>
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
    </div>
  );
}
