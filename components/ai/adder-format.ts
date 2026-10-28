import { getWeekStart } from "@/lib/views/gantt-weekly";
import { jerusalemTimeString } from "@/lib/datetime";

/** "YYYY-MM-DD" → "DD/MM/YYYY" (string-only, no timezone math). */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDayMonth(day: number, month: number): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

/** "HH:MM–HH:MM" in Jerusalem time for two ISO instants. */
export function formatTimeRange(startAt: string, endAt: string): string {
  return `${jerusalemTimeString(new Date(startAt))}–${jerusalemTimeString(new Date(endAt))}`;
}

/** Dashboard URL that opens the week containing `date` with the event's dialog open. */
export function existingEventHref(date: string, eventId: string): string {
  const week = getWeekStart(new Date(`${date}T12:00:00Z`)).toISOString().slice(0, 10);
  return `/dashboard?week=${week}&event=${encodeURIComponent(eventId)}`;
}
