import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { getEditorScopeFilters } from "@/lib/events/queries";
import { createSubscription } from "@/lib/ical/subscriptions";

/**
 * POST /api/v1/ical-subscriptions/gcal
 *
 * Creates an iCal subscription pre-filtered to the calling user's grade and
 * event-type scopes, then redirects the browser to Google Calendar's
 * "subscribe from URL" page so the feed is added as a separate named calendar.
 *
 * The redirect uses the webcal:// scheme so Google Calendar recognises it as
 * an iCal subscription rather than a one-time import.
 */
export async function POST(): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user || !user.schoolId) {
    const loginUrl = new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const filters = await getEditorScopeFilters(user.schoolId, user.id, user.role);
  const { token } = await createSubscription(user.schoolId, user.id, {
    grades: filters.grades,
    eventTypes: filters.eventTypeIds,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const host = new URL(appUrl).host;
  const webcalUrl = `webcal://${host}/ical/${token}`;
  const gcalUrl = `https://www.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  return NextResponse.redirect(gcalUrl, { status: 302 });
}
