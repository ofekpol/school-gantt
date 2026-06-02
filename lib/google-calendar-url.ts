/**
 * Builds a Google Calendar "quick-add" template URL that opens the compose
 * screen with an event pre-filled. No OAuth, no API call — the user just
 * clicks Save in Google's UI.
 *
 * Reference: https://calendar.google.com/calendar/render?action=TEMPLATE
 *
 *   all-day  → dates=YYYYMMDD/YYYYMMDD  (end exclusive: day after last day),
 *              calendar day resolved in Asia/Jerusalem so an event stored as
 *              local midnight does not drift to the previous UTC day.
 *   timed    → dates=YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ (UTC instants) plus
 *              ctz=Asia/Jerusalem so Google renders them in school-local time.
 */

const TIMEZONE = "Asia/Jerusalem";
const RENDER_BASE = "https://calendar.google.com/calendar/render";

export interface GoogleCalendarEvent {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  allDay: boolean;
}

export function buildGoogleCalendarUrl(event: GoogleCalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
  });

  if (event.allDay) {
    const start = jerusalemDateCompact(event.start);
    const end = jerusalemDateCompact(addDays(event.end, 1));
    params.set("dates", `${start}/${end}`);
  } else {
    params.set("dates", `${utcCompact(event.start)}/${utcCompact(event.end)}`);
    params.set("ctz", TIMEZONE);
  }

  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);

  return `${RENDER_BASE}?${params.toString()}`;
}

/** "YYYYMMDDTHHmmssZ" from a Date's UTC instant. */
function utcCompact(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** "YYYYMMDD" for the date's calendar day in Asia/Jerusalem. */
function jerusalemDateCompact(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}${parts.month}${parts.day}`;
}

/**
 * Returns a Date one day later in Jerusalem-local terms. We shift by the
 * Jerusalem calendar day (resolve to a noon-UTC anchor on that day, then add
 * 24h) so the exclusive all-day end never lands on the wrong side of a DST
 * transition or a UTC day boundary.
 */
function addDays(d: Date, days: number): Date {
  const ymd = jerusalemDateCompact(d);
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6));
  const day = Number(ymd.slice(6, 8));
  // Noon UTC anchor keeps the calendar day stable under ±2/3h offsets.
  return new Date(Date.UTC(year, month - 1, day + days, 12));
}
