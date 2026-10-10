import { jerusalemWallClockToIso } from "@/lib/datetime";

export interface EventTimeRangeInput {
  startDate: string;
  endDate?: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
}

export interface EventTimeRange {
  startAt: string;
  endAt: string;
}

export function buildEventTimeRange(input: EventTimeRangeInput): EventTimeRange {
  const endDate = input.endDate ?? input.startDate;
  if (endDate < input.startDate) {
    throw new RangeError("end_date_before_start_date");
  }

  if (input.allDay) {
    return {
      startAt: jerusalemWallClockToIso(input.startDate, "00:00:00"),
      endAt: jerusalemWallClockToIso(endDate, "23:59:59"),
    };
  }

  return {
    startAt: jerusalemWallClockToIso(input.startDate, input.startTime),
    endAt: jerusalemWallClockToIso(endDate, input.endTime),
  };
}
