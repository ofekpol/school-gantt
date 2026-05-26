"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { Filter, Search, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatGradeLabel } from "@/lib/grades";
import { useRouteProgress } from "@/components/RouteProgress";
import { cn } from "@/lib/utils";

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
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRow["role"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "deactivated">("all");

  const filteredStaff = initialStaff.filter((staff) => {
    const haystack =
      `${staff.email} ${staff.fullName} ${roleLabel(staff.role)} ${scopeLabel(staff)}`.toLocaleLowerCase(
        "he-IL",
      );
    const matchesQuery = haystack.includes(query.trim().toLocaleLowerCase("he-IL"));
    const matchesRole = roleFilter === "all" || staff.role === roleFilter;
    const status = staff.deactivatedAt ? "deactivated" : "active";
    return matchesQuery && matchesRole && (statusFilter === "all" || statusFilter === status);
  });

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
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="grid gap-3 border-b border-neutral-200 bg-neutral-50 p-4 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchStaff")}
            aria-label={t("searchStaff")}
            className="h-10 w-full rounded-md border border-neutral-300 bg-white ps-10 pe-3 text-sm transition outline-none focus:border-neutral-900 focus:ring-3 focus:ring-neutral-200"
          />
        </label>
        <label className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3">
          <Users className="size-4 text-neutral-500" />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as StaffRow["role"] | "all")}
            aria-label={t("filterByRole")}
            className="h-10 bg-transparent text-sm outline-none"
          >
            <option value="all">{t("allRoles")}</option>
            <option value="admin">{t("roleAdmin")}</option>
            <option value="editor">{t("roleEditor")}</option>
            <option value="viewer">{t("roleViewer")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3">
          <Filter className="size-4 text-neutral-500" />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | "active" | "deactivated")
            }
            aria-label={t("filterByStatus")}
            className="h-10 bg-transparent text-sm outline-none"
          >
            <option value="all">{t("allStatuses")}</option>
            <option value="active">{t("active")}</option>
            <option value="deactivated">{t("deactivated")}</option>
          </select>
        </label>
      </div>

      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="sticky top-0 z-10 bg-white text-xs font-semibold text-neutral-500 uppercase shadow-[0_1px_0_var(--color-border)]">
            <tr className="border-b border-neutral-200">
              <th className="py-3 ps-4 pe-4 text-start">{t("staffMember")}</th>
              <th className="py-3 pe-4 text-start">{t("role")}</th>
              <th className="py-3 pe-4 text-start">{t("status")}</th>
              <th className="py-3 pe-4 text-start">{t("scopes")}</th>
              <th className="py-3 pe-4 text-start">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((s) => (
              <Fragment key={s.id}>
                <tr className="border-b border-neutral-100 align-top transition hover:bg-neutral-50">
                  <td className="py-4 ps-4 pe-4">
                    <div className="font-medium text-neutral-950">{s.fullName}</div>
                    <div className="mt-1 text-xs text-neutral-500">{s.email}</div>
                  </td>
                  <td className="py-4 pe-4">
                    <RoleBadge role={s.role} label={roleLabel(s.role)} />
                  </td>
                  <td className="py-4 pe-4">
                    <StatusBadge
                      active={!s.deactivatedAt}
                      activeLabel={t("active")}
                      deactivatedLabel={t("deactivated")}
                    />
                  </td>
                  <td className="max-w-[320px] py-4 pe-4 text-neutral-700">{scopeLabel(s)}</td>
                  <td className="py-4 pe-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(s.id)}
                        disabled={busyId !== null}
                      >
                        {t("edit")}
                      </Button>
                      {s.deactivatedAt ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivate(s.id, false)}
                          disabled={busyId !== null}
                        >
                          {busyId === s.id ? tc("loading") : t("reactivate")}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivate(s.id, true)}
                          disabled={busyId !== null}
                        >
                          {busyId === s.id ? tc("loading") : t("deactivate")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === s.id && (
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <td colSpan={5} className="p-4">
                      <EditStaffForm
                        row={s}
                        eventTypes={eventTypes}
                        busy={busyId === s.id}
                        error={error}
                        onCancel={() => setEditingId(null)}
                        onSave={handleSave}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredStaff.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-neutral-500">{t("noStaffMatches")}</div>
      )}
    </div>
  );
}

function RoleBadge({ role, label }: { role: StaffRow["role"]; label: string }) {
  const Icon = role === "admin" ? ShieldCheck : role === "editor" ? UserCheck : Users;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700">
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

function StatusBadge({
  active,
  activeLabel,
  deactivatedLabel,
}: {
  active: boolean;
  activeLabel: string;
  deactivatedLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600",
      )}
    >
      {active ? activeLabel : deactivatedLabel}
    </span>
  );
}

function EditStaffForm({
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

  return (
    <form
      action={(form) => onSave(row, form)}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
        <input
          name="fullName"
          defaultValue={row.fullName}
          aria-label={t("fullName")}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900 focus:ring-3 focus:ring-neutral-200"
          required
        />
        <select
          name="role"
          defaultValue={row.role}
          aria-label={t("role")}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900 focus:ring-3 focus:ring-neutral-200"
        >
          <option value="viewer">{t("roleViewer")}</option>
          <option value="editor">{t("roleEditor")}</option>
          <option value="admin">{t("roleAdmin")}</option>
        </select>
      </div>
      <ScopeFields row={row} eventTypes={eventTypes} />
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

function ScopeFields({ row, eventTypes }: { row: StaffRow; eventTypes: EventTypeRow[] }) {
  const t = useTranslations("admin.staff");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <fieldset>
        <legend className="text-sm font-medium text-neutral-800">{t("gradeScopes")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL_GRADES.map((g) => (
            <label
              key={g}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name={`staff-grade-${row.id}-${g}`}
                defaultChecked={row.gradeScopes.includes(g)}
              />
              {formatGradeLabel(g)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium text-neutral-800">{t("eventTypeScopes")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {eventTypes.map((et) => (
            <label
              key={et.key}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name={`staff-type-${row.id}-${et.key}`}
                defaultChecked={row.eventTypeScopes.includes(et.key)}
              />
              {et.labelHe}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
