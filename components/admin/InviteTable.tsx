"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatGradeLabel } from "@/lib/grades";

interface InviteRow {
  id: string;
  token: string;
  role: "editor" | "admin" | "viewer";
  gradeScopes: number[];
  eventTypeScopes: string[];
  multiUse: boolean;
  expiresAt: Date | string;
  usedAt: Date | string | null;
}

const EXPIRES_AT_FMT = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  dateStyle: "short",
  timeStyle: "short",
});

export function InviteTable({ invites }: { invites: InviteRow[] }) {
  const t = useTranslations("admin.staff");
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);

  if (invites.length === 0) {
    return <p className="text-sm text-neutral-500">{t("noInvites")}</p>;
  }

  async function handleRevoke(id: string) {
    if (!confirm(t("revokeConfirm"))) return;
    setRevoking(id);
    try {
      const res = await fetch(`/api/v1/admin/staff/invites/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else alert(t("revokeError"));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200">
      <div aria-label={t("mobileInviteListLabel")} className="space-y-3 p-3 md:hidden">
        {invites.map((invite) => {
          const expired = new Date(invite.expiresAt) <= new Date();
          const isActive = !invite.usedAt && !expired;
          const status = invite.usedAt
            ? t("used")
            : expired
              ? t("expired")
              : t("active");
          const role = t(`role${capitalize(invite.role)}`);
          const scopeLabels = formatInviteScopes(invite);
          return (
            <article key={invite.id} className="rounded-lg border border-neutral-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-neutral-950">{role}</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {EXPIRES_AT_FMT.format(new Date(invite.expiresAt))}
                  </p>
                </div>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                  {status}
                </span>
              </div>
              {invite.multiUse && (
                <span className="mt-3 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                  {t("multiUseBadge")}
                </span>
              )}
              <dl className="mt-4 text-sm">
                <dt className="text-xs font-medium text-neutral-500">{t("scopes")}</dt>
                <dd className="mt-1 text-neutral-700">{scopeLabels || "—"}</dd>
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`${t("copyInvite")} ${role}`}
                  onClick={() => copyInviteUrl(invite.token)}
                >
                  {t("copyInvite")}
                </Button>
                {isActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={`${t("revokeInvite")} ${role}`}
                    disabled={revoking === invite.id}
                    onClick={() => handleRevoke(invite.id)}
                  >
                    {t("revokeInvite")}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden max-h-[420px] overflow-auto md:block">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="sticky top-0 z-10 bg-white text-xs font-semibold text-neutral-500 uppercase shadow-[0_1px_0_var(--color-border)]">
          <tr>
            <th className="py-3 ps-4 pe-4 text-start">{t("role")}</th>
            <th className="py-3 pe-4 text-start">{t("scopes")}</th>
            <th className="py-3 pe-4 text-start">{t("expiresAt")}</th>
            <th className="py-3 pe-4 text-start">{t("status")}</th>
            <th className="py-3 pe-4 text-start">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => {
            const expired = new Date(invite.expiresAt) <= new Date();
            const isActive = !invite.usedAt && !expired;
            const status = invite.usedAt
              ? t("used")
              : expired
                ? t("expired")
                : t("active");
            const scopeLabels = formatInviteScopes(invite);
            return (
              <tr key={invite.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="py-3 ps-4 pe-4">
                  <span>{t(`role${capitalize(invite.role)}`)}</span>
                  {invite.multiUse && (
                    <span className="ms-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                      {t("multiUseBadge")}
                    </span>
                  )}
                </td>
                <td className="max-w-[340px] py-3 pe-4 text-neutral-700">
                  {scopeLabels || "—"}
                </td>
                <td className="py-3 pe-4">{EXPIRES_AT_FMT.format(new Date(invite.expiresAt))}</td>
                <td className="py-3 pe-4">{status}</td>
                <td className="py-3 pe-4">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyInviteUrl(invite.token)}
                    >
                      {t("copyInvite")}
                    </Button>
                    {isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={revoking === invite.id}
                        onClick={() => handleRevoke(invite.id)}
                      >
                        {t("revokeInvite")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function copyInviteUrl(token: string) {
  const url = `${window.location.origin}/invite/${token}`;
  void navigator.clipboard.writeText(url);
}

function formatInviteScopes(invite: Pick<InviteRow, "gradeScopes" | "eventTypeScopes">) {
  return [
    ...invite.gradeScopes.map((g) => formatGradeLabel(g)),
    ...invite.eventTypeScopes,
  ].join(", ");
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
