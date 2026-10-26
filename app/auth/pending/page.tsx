import { LogoutButton } from "@/components/auth/LogoutButton";
import { getSession } from "@/lib/auth/session";
import { getPendingRegistrationByAuthId } from "@/lib/db/pending";

export default async function PendingPage() {
  const authUser = await getSession();
  const pending = authUser ? await getPendingRegistrationByAuthId(authUser.id) : null;
  // Signed up without a school's link: no admin can see this request.
  const missingSchool = pending !== null && pending.schoolId === null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-4 p-8 border rounded-lg shadow-sm text-center">
        <h1 className="text-2xl font-bold">בקשתך ממתינה לאישור</h1>
        <p className="text-muted-foreground text-sm">
          מנהל בית הספר יאשר את גישתך בקרוב. ניתן לסגור את הדף ולחזור מאוחר יותר.
        </p>
        {missingSchool && (
          <p className="text-sm text-destructive" data-testid="pending-missing-school">
            לא זוהה בית ספר לבקשה. בקשו מבית הספר את קישור ההרשמה שלו והתחברו דרכו.
          </p>
        )}
        <LogoutButton label="יציאה מהמערכת" />
      </div>
    </div>
  );
}
