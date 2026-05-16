import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; token?: string }>;
}) {
  const { next, token } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">כניסה למערכת</h1>
          <p className="text-muted-foreground text-sm">היכנסו עם חשבון Google שלכם</p>
        </div>
        <GoogleSignInButton next={next} token={token} />
      </div>
    </div>
  );
}
