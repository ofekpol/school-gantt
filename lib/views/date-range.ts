export interface CalendarRange {
  label: string;
  startDate: string;
  endDate: string;
}

interface RangeEvent {
  startAt: Date | string;
  endAt: Date | string;
}

export function buildCalendarRangeFromEvents(
  events: RangeEvent[],
  now: Date = new Date(),
): CalendarRange {
  let minYear: number | null = null;
  let maxYear: number | null = null;

  for (const event of events) {
    const start = toDate(event.startAt);
    const end = toDate(event.endAt);
    if (!start || !end) continue;
    const eventMin = schoolCycleStartYear(start);
    const eventMax = Math.max(eventMin + 1, end.getUTCFullYear());
    minYear = minYear === null ? eventMin : Math.min(minYear, eventMin);
    maxYear = maxYear === null ? eventMax : Math.max(maxYear, eventMax);
  }

  minYear ??= now.getUTCFullYear();
  maxYear ??= minYear + 1;
  maxYear = Math.max(maxYear, minYear + 1);

  const displayStartYear = minYear - 2;

  return {
    label: displayStartYear === maxYear ? String(displayStartYear) : `${displayStartYear}-${maxYear}`,
    startDate: `${displayStartYear}-01-01`,
    endDate: `${maxYear}-12-31`,
  };
}

function schoolCycleStartYear(date: Date): number {
  return date.getUTCMonth() >= 7 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
