"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/admin/ColorPicker";
import { useRouteProgress } from "@/components/RouteProgress";

interface EventTypeRow {
  id: string;
  key: string;
  labelHe: string;
  labelEn: string;
  colorHex: string;
  glyph: string;
}

interface Props {
  initial: EventTypeRow[];
  /** Admins can edit/delete; editors create-only. Defaults to true. */
  canManage?: boolean;
}

interface CreateForm {
  key: string;
  labelHe: string;
  labelEn: string;
  colorHex: string;
  glyph: string;
}

interface EditState {
  id: string;
  form: CreateForm;
}

type SortKey = "key" | "labelHe" | "labelEn" | "glyph";

interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}

const EMPTY_FORM: CreateForm = {
  key: "",
  labelHe: "",
  labelEn: "",
  colorHex: "#1f77b4",
  glyph: "",
};

const SORTABLE_HEADERS: { key: SortKey; label: "key" | "labelHe" | "labelEn" | "glyph" }[] = [
  { key: "key", label: "key" },
  { key: "labelHe", label: "labelHe" },
  { key: "labelEn", label: "labelEn" },
  { key: "glyph", label: "glyph" },
];

export function EventTypeTable({ initial, canManage = true }: Props) {
  const t = useTranslations("admin.eventTypes");
  const tc = useTranslations("common");
  const router = useRouter();
  const startRouteProgress = useRouteProgress();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "labelHe", direction: "asc" });

  const sortedRows = useMemo(() => {
    return initial.slice().sort((a, b) => {
      const result = a[sort.key].localeCompare(b[sort.key], sort.key === "labelHe" ? "he" : "en", {
        sensitivity: "base",
      });
      return sort.direction === "asc" ? result : -result;
    });
  }, [initial, sort]);

  function updateCreateForm<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setCreateForm((form) => ({ ...form, [key]: value }));
  }

  function handleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  function renderSortableHeader(key: SortKey, labelKey: "key" | "labelHe" | "labelEn" | "glyph") {
    const active = sort.key === key;
  return (
      <th
        key={key}
        className="py-2 pe-3 text-start"
        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => handleSort(key)}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{t(labelKey)}</span>
          {active &&
            (sort.direction === "asc" ? (
              <ArrowUp aria-hidden="true" className="size-3.5" />
            ) : (
              <ArrowDown aria-hidden="true" className="size-3.5" />
            ))}
        </button>
      </th>
    );
  }

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
    setSavingEdit(true);
    const res = await fetch(`/api/v1/admin/event-types/${editState.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editState.form),
    });
    setSavingEdit(false);
    if (res.ok) {
      setEditState(null);
      startRouteProgress(2500);
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    setInlineError(null);
    setDeletingId(id);
    const res = await fetch(`/api/v1/admin/event-types/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      startRouteProgress(2500);
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
        <form onSubmit={handleCreate} className="border rounded p-3 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="block text-sm">{t("key")}</span>
              <input
                required
                value={createForm.key}
                onChange={(e) => updateCreateForm("key", e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm">{t("glyph")}</span>
              <input
                required
                value={createForm.glyph}
                onChange={(e) => updateCreateForm("glyph", e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm">{t("labelHe")}</span>
              <input
                required
                value={createForm.labelHe}
                onChange={(e) => updateCreateForm("labelHe", e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm">{t("labelEn")}</span>
              <input
                required
                value={createForm.labelEn}
                onChange={(e) => updateCreateForm("labelEn", e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <div className="col-span-2">
              <span className="block text-sm mb-1">{t("colorHex")}</span>
              <ColorPicker
                value={createForm.colorHex}
                onChange={(hex) => updateCreateForm("colorHex", hex)}
              />
            </div>
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
            {SORTABLE_HEADERS.slice(0, 3).map((header) =>
              renderSortableHeader(header.key, header.label),
            )}
            <th className="text-start py-2 pe-3">{t("colorHex")}</th>
            {renderSortableHeader("glyph", "glyph")}
            <th className="text-start py-2"></th>
          </tr>
        </thead>
        <tbody>
          {initial.length === 0 && (
            <tr className="border-t">
              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                {t("empty")}
              </td>
            </tr>
          )}
          {sortedRows.map((row) =>
            editState?.id === row.id ? (
              <tr key={row.id} className="border-t">
                <td colSpan={6} className="py-2">
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
                    <ColorPicker
                      value={editState.form.colorHex}
                      onChange={(hex) =>
                        setEditState((s) =>
                          s ? { ...s, form: { ...s.form, colorHex: hex } } : s,
                        )
                      }
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
                    <Button type="submit" size="sm" disabled={savingEdit}>
                      {savingEdit ? tc("saving") : t("save")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditState(null)} disabled={savingEdit}>
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
                <td className="py-2">
                  {canManage && (
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
                      disabled={deletingId !== null}
                    >
                      {deletingId === row.id ? tc("loading") : t("delete")}
                    </Button>
                  </span>
                  )}
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
