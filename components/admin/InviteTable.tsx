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
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2 pe-4 text-start">{t("role")}</th>
          <th className="py-2 pe-4 text-start">{t("scopes")}</th>
          <th className="py-2 pe-4 text-start">{t("expiresAt")}</th>
          <th className="py-2 pe-4 text-start">{t("status")}</th>
          <th className="py-2 text-start"></th>
        </tr>
      </thead>
      <tbody>
        {invites.map((invite) => {
          const expired = new Date(invite.expiresAt) <= new Date();
          const status = invite.usedAt ? t("used") : expired ? t("expired") : t("active");
          return (
            <tr key={invite.id} className="border-t">
              <td className="py-2 pe-4">{t(`role${capitalize(invite.role)}`)}</td>
              <td className="py-2 pe-4">
                {[...invite.gradeScopes.map(String), ...invite.eventTypeScopes].join(", ") || "—"}
              </td>
              <td className="py-2 pe-4">{EXPIRES_AT_FMT.format(new Date(invite.expiresAt))}</td>
              <td className="py-2 pe-4">{status}</td>
              <td className="py-2">
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
  );
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
