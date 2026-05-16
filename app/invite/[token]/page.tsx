import { redirect } from "next/navigation";
import { getInviteByToken } from "@/lib/db/invites";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function InvitePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await getInviteByToken(token);

  if (invite && !invite.usedAt && invite.expiresAt > new Date() && !error) {
    redirect(`/auth/login?token=${token}&next=/dashboard`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-3 rounded-lg border p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Invite unavailable</h1>
        <p className="text-sm text-muted-foreground">
          This invite link is expired, already used, or no longer exists.
        </p>
      </div>
    </main>
  );
}
