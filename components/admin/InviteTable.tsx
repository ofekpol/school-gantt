"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface InviteRow {
  id: string;
  token: string;
  role: "editor" | "admin" | "viewer";
  gradeScopes: number[];
  eventTypeScopes: string[];
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

  if (invites.length === 0) {
    return <p className="text-sm text-neutral-500">{t("noInvites")}</p>;
  }

  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-neutral-200">
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
            const status = invite.usedAt ? t("used") : expired ? t("expired") : t("active");
            return (
              <tr key={invite.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="py-3 ps-4 pe-4">{t(`role${capitalize(invite.role)}`)}</td>
                <td className="max-w-[340px] py-3 pe-4 text-neutral-700">
                  {[...invite.gradeScopes.map(String), ...invite.eventTypeScopes].join(", ") || "—"}
                </td>
                <td className="py-3 pe-4">{EXPIRES_AT_FMT.format(new Date(invite.expiresAt))}</td>
                <td className="py-3 pe-4">{status}</td>
                <td className="py-3 pe-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const url = `${window.location.origin}/invite/${invite.token}`;
                      void navigator.clipboard.writeText(url);
                    }}
                  >
                    {t("copyInvite")}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
