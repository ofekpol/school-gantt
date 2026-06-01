"use client";

import { useState } from "react";

interface RegisterFormProps {
  onSuccess?: () => void;
  inviteToken?: string;
}

export function RegisterForm({ onSuccess, inviteToken }: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    if (password.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, fullName, password, ...(inviteToken ? { inviteToken } : {}) }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setError("כתובת האימייל כבר רשומה במערכת");
        return;
      }
      if (!res.ok) {
        setError("אירעה שגיאה. נסו שוב מאוחר יותר");
        return;
      }
      if (data.status === "confirmation_sent") {
        setSent(true);
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center py-4">
        <p className="font-medium">בדקו את תיבת הדואר שלכם</p>
        <p className="text-sm text-muted-foreground">
          שלחנו קישור אישור לכתובת <strong>{email}</strong>. לחצו על הקישור כדי להפעיל את החשבון.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="reg-fullName" className="text-sm font-medium">
          שם מלא
        </label>
        <input
          id="reg-fullName"
          type="text"
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="auto"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="reg-email" className="text-sm font-medium">
          אימייל
        </label>
        <input
          id="reg-email"
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
        <label htmlFor="reg-password" className="text-sm font-medium">
          סיסמה
        </label>
        <input
          id="reg-password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="reg-confirm" className="text-sm font-medium">
          אישור סיסמה
        </label>
        <input
          id="reg-confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
        {loading ? "שולח..." : "הרשמה"}
      </button>
    </form>
  );
}
