import { EmailPasswordSignInForm } from "@/components/auth/EmailPasswordSignInForm";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}) {
  const { confirmed, error } = await searchParams;

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

        <EmailPasswordSignInForm />

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
