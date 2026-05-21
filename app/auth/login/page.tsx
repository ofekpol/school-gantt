import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { EmailPasswordSignInForm } from "@/components/auth/EmailPasswordSignInForm";
import { getPostLoginRedirect } from "@/lib/auth/redirects";
import { getStaffUser } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; token?: string; confirmed?: string; error?: string }>;
}) {
  const { next, token, confirmed, error } = await searchParams;
  const user = await getStaffUser();
  if (user) redirect(getPostLoginRedirect(user));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">כניסה למערכת</h1>
        </div>

        {confirmed === "1" && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
            האימייל אושר בהצלחה. כעת ניתן להתחבר.
          </div>
        )}

        {error === "invalid_token" && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
            קישור האישור אינו תקף או פג תוקפו. נסו להירשם שוב.
          </div>
        )}

        <div className="space-y-4">
          <EmailPasswordSignInForm />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">או</span>
            </div>
          </div>

          <GoogleSignInButton next={next} token={token} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          עדיין אין לכם חשבון?{" "}
          <Link href="/auth/register" className="underline hover:text-foreground">
            הרשמה
          </Link>
        </p>
      </div>
    </div>
  );
}
