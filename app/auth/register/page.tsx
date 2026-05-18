import { RegisterForm } from "@/components/auth/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">הרשמה למערכת</h1>
          <p className="text-muted-foreground text-sm">צרו חשבון חדש</p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          כבר יש לכם חשבון?{" "}
          <Link href="/auth/login" className="underline hover:text-foreground">
            כניסה
          </Link>
        </p>
      </div>
    </div>
  );
}
