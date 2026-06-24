"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ALL_GRADES, ScopeFields } from "@/components/admin/ScopeFields";

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

export function EditStaffForm({
  row,
  eventTypes,
  busy,
  error,
  onCancel,
  onSave,
}: {
  row: StaffRow;
  eventTypes: EventTypeRow[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (row: StaffRow, form: FormData) => void;
}) {
  const t = useTranslations("admin.staff");
  const tc = useTranslations("common");
  const [role, setRole] = useState<StaffRow["role"]>(row.role);

  useEffect(() => {
    setRole(row.role);
  }, [row.id, row.role]);

  return (
    <form action={(form) => onSave(row, form)} className="mt-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-neutral-700">{t("fullName")}</span>
          <input
            name="fullName"
            defaultValue={row.fullName}
            className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900 focus:ring-3 focus:ring-neutral-200"
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-neutral-700">{t("role")}</span>
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRow["role"])}
            className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900 focus:ring-3 focus:ring-neutral-200"
          >
            <option value="viewer">{t("roleViewer")}</option>
            <option value="editor">{t("roleEditor")}</option>
            <option value="admin">{t("roleAdmin")}</option>
          </select>
        </label>
      </div>
      {role === "editor" && (
        <ScopeFields
          eventTypes={eventTypes}
          gradeName={(grade) => `staff-grade-${row.id}-${grade}`}
          typeName={(key) => `staff-type-${row.id}-${key}`}
          defaultGradeScopes={row.gradeScopes}
          defaultEventTypeScopes={row.eventTypeScopes}
          labels={{
            gradeScopes: t("gradeScopes"),
            eventTypeScopes: t("eventTypeScopes"),
            selectAllGrades: t("selectAllGrades"),
            clearAllGrades: t("clearAllGrades"),
            selectAllEventTypes: t("selectAllEventTypes"),
            clearAllEventTypes: t("clearAllEventTypes"),
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? tc("saving") : t("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          {t("cancel")}
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

export { ALL_GRADES };
