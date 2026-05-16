"use client";

import { useRouter } from "next/navigation";
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

export function StaffTable({ initialStaff }: Props) {
  const t = useTranslations("admin.staff");
  const router = useRouter();

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
                {s.role === "admin"
                  ? t("roleAdmin")
                  : s.role === "viewer"
                    ? t("roleViewer")
                    : t("roleEditor")}
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
