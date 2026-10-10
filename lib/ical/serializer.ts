/**
 * RFC 5545 iCalendar serializer — VEVENT only, deterministic output.
 *
 * Hand-written instead of pulling in `ical-generator` so:
 *   - the bytes stay byte-stable for ETag comparisons,
 *   - we never emit a server-time DTSTAMP (RFC requires it, but Google
 *     handles a fixed one from updatedAt fine; we want determinism more
 *     than DTSTAMP-honesty here),
 *   - the file is small and reviewable.
 *
 * Field mapping (PRD §6.4):
 *   SUMMARY     ← title
 *   DTSTART     ← startAt (UTC; all-day: VALUE=DATE of the Jerusalem-local day)
 *   DTEND       ← endAt   (UTC; all-day: VALUE=DATE of the day *after* the
 *                          last Jerusalem-local day — RFC 5545 end is exclusive)
 *   LOCATION    ← location (caller resolves "first line of requirements")
 *   DESCRIPTION ← description
 *   CATEGORIES  ← event type label
 */

import { addCalendarDays } from "@/lib/datetime";
import { eventJerusalemDateRange } from "@/lib/views/date-status";

export interface ICalEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  eventTypeLabelHe: string;
  updatedAt: Date;
  canceled?: boolean;
}

export interface SerializeInput {
  schoolName: string;
  schoolSlug: string;
  events: ICalEvent[];
}

const PRODID = "-//school-gantt//he//EN";
const CRLF = "\r\n";

export function serializeCalendar(input: SerializeInput): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.schoolName)}`,
  ];

  // Stable order so output is deterministic for ETag.
  const sorted = input.events.slice().sort((a, b) => {
    const ta = a.startAt.getTime();
    const tb = b.startAt.getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  for (const evt of sorted) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${evt.id}@${input.schoolSlug}.school-gantt`);
    lines.push(`DTSTAMP:${formatUtc(evt.updatedAt)}`);
    const days = evt.allDay ? allDayDates(evt) : null;
    if (days) {
      lines.push(`DTSTART;VALUE=DATE:${days.start}`);
      lines.push(`DTEND;VALUE=DATE:${days.end}`);
    } else {
      lines.push(`DTSTART:${formatUtc(evt.startAt)}`);
      lines.push(`DTEND:${formatUtc(evt.endAt)}`);
    }
    if (evt.canceled) lines.push("STATUS:CANCELLED");
    lines.push(`SUMMARY:${escapeText(evt.canceled ? `בוטל - ${evt.title}` : evt.title)}`);
    if (evt.location)
      lines.push(`LOCATION:${escapeText(evt.location)}`);
    if (evt.description)
      lines.push(`DESCRIPTION:${escapeText(evt.description)}`);
    lines.push(`CATEGORIES:${escapeText(evt.eventTypeLabelHe)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // RFC 5545 §3.1 — fold lines longer than 75 octets. We avoid generating
  // any to keep the serializer simple; if a title exceeds 75 the line will
  // still parse but may render oddly in conservative parsers.
  return lines.join(CRLF) + CRLF;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function formatUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * All-day DTSTART/DTEND as YYYYMMDD. The days are resolved in Asia/Jerusalem
 * (the same span the Gantt/calendar views use) — the UTC date of a local
 * midnight is the previous day. DTEND is exclusive, so it is the day after the
 * last covered day. Null for an empty span (caller falls back to UTC instants).
 */
function allDayDates(evt: ICalEvent): { start: string; end: string } | null {
  const range = eventJerusalemDateRange(evt);
  if (!range) return null;
  return {
    start: range.startDate.replace(/-/g, ""),
    end: addCalendarDays(range.endDate, 1).replace(/-/g, ""),
  };
}

/** RFC 5545 §3.3.11 — TEXT escaping: \\, comma, semicolon, newline. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
