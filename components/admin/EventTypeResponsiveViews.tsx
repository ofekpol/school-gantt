"use client";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/admin/ColorPicker";

interface EventTypeRow {
  id: string;
  key: string;
  labelHe: string;
  labelEn: string;
  colorHex: string;
  glyph: string;
}

interface CreateForm {
  key: string;
  labelHe: string;
  labelEn: string;
  colorHex: string;
  glyph: string;
}

interface Labels extends Record<keyof CreateForm | "save" | "cancel", string> {
  edit: string;
  delete: string;
  empty: string;
  loading: string;
  mobileListLabel: string;
}

interface EditState {
  id: string;
  form: CreateForm;
}

export function EventTypeMobileList({
  rows,
  editState,
  labels,
  savingEdit,
  canManage,
  deletingId,
  onOpenEdit,
  onChangeEdit,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
}: {
  rows: EventTypeRow[];
  editState: EditState | null;
  labels: Labels;
  savingEdit: boolean;
  canManage: boolean;
  deletingId: string | null;
  onOpenEdit: (row: EventTypeRow) => void;
  onChangeEdit: <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => void;
  onSubmitEdit: (event: React.FormEvent) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div aria-label={labels.mobileListLabel} className="space-y-3 md:hidden">
      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {labels.empty}
        </div>
      )}
      {rows.map((row) => (
        <article key={row.id} className="rounded-lg border bg-white p-4 shadow-sm">
          {editState?.id === row.id ? (
            <EventTypeEditForm
              form={editState.form}
              saving={savingEdit}
              onCancel={onCancelEdit}
              onChange={onChangeEdit}
              onSubmit={onSubmitEdit}
              labels={labels}
            />
          ) : (
            <EventTypeCard
              row={row}
              labels={labels}
              canManage={canManage}
              deletingId={deletingId}
              onOpenEdit={onOpenEdit}
              onDelete={onDelete}
            />
          )}
        </article>
      ))}
    </div>
  );
}

function EventTypeCard({
  row,
  labels,
  canManage,
  deletingId,
  onOpenEdit,
  onDelete,
}: {
  row: EventTypeRow;
  labels: Labels;
  canManage: boolean;
  deletingId: string | null;
  onOpenEdit: (row: EventTypeRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold break-words">{row.labelHe}</h3>
          <p className="mt-1 text-sm break-words text-muted-foreground">{row.labelEn}</p>
        </div>
        <span className="rounded-md border px-2 py-1 text-sm font-medium">{row.glyph}</span>
      </div>
      <dl className="mt-4 grid gap-2 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{labels.key}</dt>
          <dd className="mt-0.5 break-all">{row.key}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{labels.colorHex}</dt>
          <dd className="mt-1 flex items-center gap-2">
            <ColorSwatch colorHex={row.colorHex} />
            <span>{row.colorHex}</span>
          </dd>
        </div>
      </dl>
      {canManage && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={`${labels.edit} ${row.labelHe}`}
            onClick={() => onOpenEdit(row)}
          >
            {labels.edit}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            aria-label={`${labels.delete} ${row.labelHe}`}
            onClick={() => onDelete(row.id)}
            disabled={deletingId !== null}
          >
            {deletingId === row.id ? labels.loading : labels.delete}
          </Button>
        </div>
      )}
    </>
  );
}

export function ColorSwatch({ colorHex }: { colorHex: string }) {
  return (
    <span
      className="inline-block size-4 rounded-sm"
      style={{ background: colorHex }}
      aria-hidden="true"
    />
  );
}

export function EventTypeEditForm({
  form,
  labels,
  saving,
  desktop = false,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: CreateForm;
  labels: Record<keyof CreateForm | "save" | "cancel", string>;
  saving: boolean;
  desktop?: boolean;
  onChange: <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={desktop ? "flex flex-wrap items-center gap-2" : "grid gap-3"}
    >
      <EventTypeTextInput
        label={labels.key}
        value={form.key}
        className={desktop ? "w-24" : "w-full"}
        onChange={(value) => onChange("key", value)}
      />
      <EventTypeTextInput
        label={labels.labelHe}
        value={form.labelHe}
        className={desktop ? "w-28" : "w-full"}
        onChange={(value) => onChange("labelHe", value)}
      />
      <EventTypeTextInput
        label={labels.labelEn}
        value={form.labelEn}
        className={desktop ? "w-28" : "w-full"}
        onChange={(value) => onChange("labelEn", value)}
      />
      <div className={desktop ? "" : "min-w-0"}>
        {!desktop && <span className="mb-1 block text-sm">{labels.colorHex}</span>}
        <ColorPicker value={form.colorHex} onChange={(hex) => onChange("colorHex", hex)} />
      </div>
      <EventTypeTextInput
        label={labels.glyph}
        value={form.glyph}
        className={desktop ? "w-16" : "w-full"}
        onChange={(value) => onChange("glyph", value)}
      />
      <div className={desktop ? "flex gap-2" : "grid grid-cols-2 gap-2"}>
        <Button type="submit" size="sm" disabled={saving}>
          {labels.save}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}

function EventTypeTextInput({
  label,
  value,
  className,
  onChange,
}: {
  label: string;
  value: string;
  className: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-sm md:sr-only">{label}</span>
      <input
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`rounded border px-2 py-1 ${className}`}
      />
    </label>
  );
}
