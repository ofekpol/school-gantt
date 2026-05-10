import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { staffUsers } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/validations/auth";

const MAX_ATTEMPTS = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes (AUTH-03)

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Step 1: Lookup staff_user by email (service-role bypasses RLS — we don't yet know schoolId).
  const [staff] = await db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.email, email))
    .limit(1);

  // Generic 401 for unknown email — do NOT leak existence.
  if (!staff) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Step 2: Lockout precheck (AUTH-03).
  const now = new Date();
  if (staff.lockedUntil && staff.lockedUntil > now) {
    return NextResponse.json(
      { error: "Account locked. Try again later." },
      { status: 423 },
    );
  }

  // Step 3: Use the SSR Supabase client so it sets cookies on the response.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    // Step 4a: Increment counter; lock if threshold reached.
    const newAttempts = (staff.loginAttempts ?? 0) + 1;
    const shouldLock = newAttempts >= MAX_ATTEMPTS;
    await db
      .update(staffUsers)
      .set({
        loginAttempts: newAttempts,
        lockedUntil: shouldLock ? new Date(now.getTime() + LOCKOUT_WINDOW_MS) : staff.lockedUntil,
      })
      .where(eq(staffUsers.id, staff.id));

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Step 4b: Success → reset counter + clear lockout.
  await db
    .update(staffUsers)
    .set({
      loginAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(staffUsers.id, staff.id));

  return NextResponse.json(
    {
      user: {
        id: staff.id,
        email: staff.email,
        role: staff.role,
        schoolId: staff.schoolId,
      },
    },
    { status: 200 },
  );
}
