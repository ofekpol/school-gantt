import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getInviteByToken } from "@/lib/db/invites";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function InvitePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { error } = await searchParams;
  const t = await getTranslations("invite");
  const tStaff = await getTranslations("admin.staff");

  const invite = await getInviteByToken(token);
  const isValid =
    invite &&
    invite.expiresAt > new Date() &&
    (invite.multiUse || !invite.usedAt) &&
    !error;

  if (!isValid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-3 rounded-lg border p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">{t("unavailableTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("unavailableBody")}</p>
        </div>
      </main>
    );
  }

  const roleLabel =
    invite.role === "admin"
      ? tStaff("roleAdmin")
      : invite.role === "editor"
        ? tStaff("roleEditor")
        : tStaff("roleViewer");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 text-center shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("roleLabel", { role: roleLabel })}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href={`/auth/register?token=${token}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            {t("register")}
          </Link>
          <Link
            href={`/auth/login?token=${token}`}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t("login")}
          </Link>
        </div>
      </div>
    </main>
  );
}
