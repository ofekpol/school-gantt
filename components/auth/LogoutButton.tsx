"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRouteProgress } from "@/components/RouteProgress";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  const startRouteProgress = useRouteProgress();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    startRouteProgress();
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      type="button"
      disabled={loading}
      className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      {label}
    </button>
  );
}
