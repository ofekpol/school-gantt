import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSchoolBySlug } from "@/lib/db/schools";
import { getSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  params: Promise<{ school: string }>;
}

export default async function ViewerSchoolLayout({ children, params }: Props) {
  const { school: slug } = await params;
  const [school, session, t] = await Promise.all([
    getSchoolBySlug(slug),
    getSession(),
    getTranslations("nav"),
  ]);

  if (!school) notFound();

  return (
    <>
      <AppHeader
        title={school.name}
        rightSlot={session ? <LogoutButton label={t("logout")} /> : undefined}
      />
      {children}
    </>
  );
}
