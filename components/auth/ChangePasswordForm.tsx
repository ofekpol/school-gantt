"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.status === 422) {
        const fieldErrors = data.details?.fieldErrors?.password;
        setError(Array.isArray(fieldErrors) ? fieldErrors[0] : "סיסמה לא תקינה");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "אירעה שגיאה. נסו שוב מאוחר יותר");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="new-password" className="text-sm font-medium">
          סיסמה חדשה
        </label>
        <input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">לפחות 8 תווים, אות גדולה אחת וספרה אחת</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          אימות סיסמה
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
        {loading ? "שומר..." : "עדכן סיסמה"}
      </button>
    </form>
  );
}
