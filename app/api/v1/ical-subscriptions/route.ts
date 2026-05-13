import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import {
  createSubscription,
  listSubscriptionsForStaff,
} from "@/lib/ical/subscriptions";
import { ICalSubscriptionSchema } from "@/lib/validations/events";

export async function GET(): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listSubscriptionsForStaff(user.schoolId, user.id);
  return NextResponse.json({ subscriptions: rows }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = ICalSubscriptionSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createSubscription(user.schoolId, user.id, {
    grades: parsed.data.grades ?? [],
    eventTypes: parsed.data.eventTypes ?? [],
  });

  return NextResponse.json(
    { id: result.id, token: result.token },
    { status: 201 },
  );
}
