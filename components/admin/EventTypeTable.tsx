"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface EventTypeRow {
  id: string;
  key: string;
  labelHe: string;
  labelEn: string;
  colorHex: string;
  glyph: string;
  sortOrder: number;
}

interface Props {
  initial: EventTypeRow[];
}

interface CreateForm {
  key: string;
  labelHe: string;
  labelEn: string;
  colorHex: string;
  glyph: string;
  sortOrder: number;
}

interface EditState {
  id: string;
  form: CreateForm;
}

const EMPTY_FORM: CreateForm = {
  key: "",
  labelHe: "",
  labelEn: "",
  colorHex: "#000000",
  glyph: "",
  sortOrder: 0,
};

export function EventTypeTable({ initial }: Props) {
  const t = useTranslations("admin.eventTypes");
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setInlineError(null);
    const res = await fetch("/api/v1/admin/event-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    setCreating(false);
    if (res.status === 201) {
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      router.refresh();
    } else {
      setInlineError("Error creating event type");
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editState) return;
    const res = await fetch(`/api/v1/admin/event-types/${editState.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editState.form),
    });
    if (res.ok) {
      setEditState(null);
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    setInlineError(null);
    const res = await fetch(`/api/v1/admin/event-types/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else if (res.status === 409) {
      setInlineError(t("inUse"));
    }
  }

  return (
    <div>
      <Button onClick={() => setShowCreate((s) => !s)} className="mb-4">
        {t("create")}
      </Button>
      {showCreate && (
        <form onSubmit={handleCreate} className="border rounded p-3 mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder={t("key")}
              required
              value={createForm.key}
              onChange={(e) => setCreateForm((f) => ({ ...f, key: e.target.value }))}
              className="border rounded px-2 py-1"
            />
            <input
              placeholder={t("glyph")}
              value={createForm.glyph}
              onChange={(e) => setCreateForm((f) => ({ ...f, glyph: e.target.value }))}
              className="border rounded px-2 py-1"
            />
            <input
              placeholder={t("labelHe")}
              required
              value={createForm.labelHe}
              onChange={(e) => setCreateForm((f) => ({ ...f, labelHe: e.target.value }))}
              className="border rounded px-2 py-1"
            />
            <input
              placeholder={t("labelEn")}
              required
              value={createForm.labelEn}
              onChange={(e) => setCreateForm((f) => ({ ...f, labelEn: e.target.value }))}
              className="border rounded px-2 py-1"
            />
            <input
              placeholder={t("colorHex")}
              value={createForm.colorHex}
              onChange={(e) => setCreateForm((f) => ({ ...f, colorHex: e.target.value }))}
              className="border rounded px-2 py-1"
            />
            <input
              type="number"
              placeholder={t("sortOrder")}
              value={createForm.sortOrder}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))
              }
              className="border rounded px-2 py-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={creating}>
              {t("save")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              {t("cancel")}
            </Button>
            {inlineError && (
              <span role="alert" className="text-red-500 text-sm">
                {inlineError}
              </span>
            )}
          </div>
        </form>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-start py-2 pe-3">{t("key")}</th>
            <th className="text-start py-2 pe-3">{t("labelHe")}</th>
            <th className="text-start py-2 pe-3">{t("labelEn")}</th>
            <th className="text-start py-2 pe-3">{t("colorHex")}</th>
            <th className="text-start py-2 pe-3">{t("glyph")}</th>
            <th className="text-start py-2 pe-3">{t("sortOrder")}</th>
            <th className="text-start py-2"></th>
          </tr>
        </thead>
        <tbody>
          {initial.map((row) =>
            editState?.id === row.id ? (
              <tr key={row.id} className="border-t">
                <td colSpan={7} className="py-2">
                  <form onSubmit={handleEdit} className="flex flex-wrap gap-2 items-center">
                    <input
                      value={editState.form.key}
                      onChange={(e) =>
                        setEditState((s) =>
                          s ? { ...s, form: { ...s.form, key: e.target.value } } : s,
                        )
                      }
                      className="border rounded px-2 py-1 w-24"
                    />
                    <input
                      value={editState.form.labelHe}
                      onChange={(e) =>
                        setEditState((s) =>
                          s ? { ...s, form: { ...s.form, labelHe: e.target.value } } : s,
                        )
                      }
                      className="border rounded px-2 py-1 w-28"
                    />
                    <input
                      value={editState.form.labelEn}
                      onChange={(e) =>
                        setEditState((s) =>
                          s ? { ...s, form: { ...s.form, labelEn: e.target.value } } : s,
                        )
                      }
                      className="border rounded px-2 py-1 w-28"
                    />
                    <input
                      value={editState.form.colorHex}
                      onChange={(e) =>
                        setEditState((s) =>
                          s ? { ...s, form: { ...s.form, colorHex: e.target.value } } : s,
                        )
                      }
                      className="border rounded px-2 py-1 w-24"
                    />
                    <input
                      value={editState.form.glyph}
                      onChange={(e) =>
                        setEditState((s) =>
                          s ? { ...s, form: { ...s.form, glyph: e.target.value } } : s,
                        )
                      }
                      className="border rounded px-2 py-1 w-16"
                    />
                    <Button type="submit" size="sm">
                      {t("save")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditState(null)}>
                      {t("cancel")}
                    </Button>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={row.id} className="border-t">
                <td className="py-2 pe-3">{row.key}</td>
                <td className="py-2 pe-3">{row.labelHe}</td>
                <td className="py-2 pe-3">{row.labelEn}</td>
                <td className="py-2 pe-3">
                  <span className="flex items-center gap-2">
                    <span
                      style={{ background: row.colorHex, width: "1rem", height: "1rem", display: "inline-block", borderRadius: "2px" }}
                    />
                    {row.colorHex}
                  </span>
                </td>
                <td className="py-2 pe-3">{row.glyph}</td>
                <td className="py-2 pe-3">{row.sortOrder}</td>
                <td className="py-2">
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditState({
                          id: row.id,
                          form: {
                            key: row.key,
                            labelHe: row.labelHe,
                            labelEn: row.labelEn,
                            colorHex: row.colorHex,
                            glyph: row.glyph,
                            sortOrder: row.sortOrder,
                          },
                        })
                      }
                    >
                      {t("edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(row.id)}
                    >
                      {t("delete")}
                    </Button>
                  </span>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {inlineError && (
        <p role="alert" className="text-red-500 text-sm mt-2">
          {inlineError}
        </p>
      )}
    </div>
  );
}
