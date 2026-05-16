import { LogoutButton } from "@/components/auth/LogoutButton";

export default function DeactivatedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-4 p-8 border rounded-lg shadow-sm text-center">
        <h1 className="text-2xl font-bold">החשבון שלך הושבת</h1>
        <p className="text-muted-foreground text-sm">
          פנה למנהל בית הספר לפרטים נוספים.
        </p>
        <LogoutButton label="יציאה מהמערכת" />
      </div>
    </div>
  );
}
