"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EmailPasswordSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.status === 423) {
        const until = data.lockedUntil
          ? new Date(data.lockedUntil).toLocaleTimeString("he-IL")
          : "";
        setError(`החשבון נעול זמנית. נסו שוב אחרי ${until}`);
        setLoading(false);
        return;
      }
      if (res.status === 401) {
        const remaining = data.attemptsRemaining ?? "";
        setError(
          remaining
            ? `אימייל או סיסמה שגויים. נותרו ${remaining} ניסיונות`
            : "אימייל או סיסמה שגויים",
        );
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("אירעה שגיאה. נסו שוב מאוחר יותר");
        setLoading(false);
        return;
      }

      // Keep loading=true — page unmounts on navigation, no need to reset.
      router.replace(data.redirectTo ?? "/dashboard");
    } catch {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="signin-email" className="text-sm font-medium">
          אימייל
        </label>
        <input
          id="signin-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="signin-password" className="text-sm font-medium">
          סיסמה
        </label>
        <input
          id="signin-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "מתחבר..." : "כניסה"}
      </button>
    </form>
  );
}
