import { LogoutButton } from "@/components/auth/LogoutButton";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-4 p-8 border rounded-lg shadow-sm text-center">
        <h1 className="text-2xl font-bold">בקשתך ממתינה לאישור</h1>
        <p className="text-muted-foreground text-sm">
          מנהל בית הספר יאשר את גישתך בקרוב. ניתן לסגור את הדף ולחזור מאוחר יותר.
        </p>
        <LogoutButton label="יציאה מהמערכת" />
      </div>
    </div>
  );
}
