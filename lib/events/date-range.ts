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
      startAt: `${input.startDate}T00:00:00+02:00`,
      endAt: `${endDate}T23:59:59+02:00`,
    };
  }

  return {
    startAt: `${input.startDate}T${input.startTime}:00+02:00`,
    endAt: `${endDate}T${input.endTime}:00+02:00`,
  };
}
