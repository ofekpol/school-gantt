import { z } from "zod";

/**
 * Smart event adder shapes. Client-safe (no server-only): the review dialog
 * imports these too.
 */

const nullableInt = z.number().int().nullable();
const nullableTime = z.string().nullable();

/** One event as the model reads it from the text — raw parts, nothing inferred. */
export const ExtractedEventSchema = z.object({
  title: z.string(),
  startDay: nullableInt,
  startMonth: nullableInt,
  startYear: nullableInt,
  endDay: nullableInt,
  endMonth: nullableInt,
  endYear: nullableInt,
  startTime: nullableTime,
  endTime: nullableTime,
  allDay: z.boolean().nullable(),
  grades: z.array(z.number().int()),
  allGrades: z.boolean(),
  eventTypeKey: z.string().nullable(),
  typeConfident: z.boolean(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  recurring: z.boolean(),
});

export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

export const ExtractionSchema = z.object({ events: z.array(ExtractedEventSchema).max(30) });

export const AdderWarningSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("missing_title") }),
  z.object({ code: z.literal("missing_date") }),
  z.object({ code: z.literal("invalid_date") }),
  z.object({ code: z.literal("missing_year") }),
  z.object({ code: z.literal("missing_grades") }),
  z.object({ code: z.literal("missing_time") }),
  z.object({ code: z.literal("uncertain_type") }),
  z.object({ code: z.literal("recurring") }),
  z.object({ code: z.literal("grade_out_of_scope"), grades: z.array(z.number().int()) }),
  z.object({
    code: z.literal("duplicate"),
    eventId: z.string(),
    title: z.string(),
    date: z.string(),
  }),
  z.object({
    code: z.literal("overlap"),
    eventId: z.string(),
    title: z.string(),
    grades: z.array(z.number().int()),
    startAt: z.string(),
    endAt: z.string(),
  }),
]);

export type AdderWarning = z.infer<typeof AdderWarningSchema>;
export type AdderWarningCode = AdderWarning["code"];

/** An event ready for review: normalized fields plus what still needs attention. */
export const CandidateEventSchema = z.object({
  clientId: z.string(),
  title: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  dateHint: z.object({ day: z.number().int(), month: z.number().int() }).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  allDay: z.boolean().nullable(),
  grades: z.array(z.number().int()),
  eventTypeId: z.string().nullable(),
  location: z.string(),
  description: z.string(),
  warnings: z.array(AdderWarningSchema),
});

export type CandidateEvent = z.infer<typeof CandidateEventSchema>;

/** Warnings that describe the surrounding calendar, not a field the user must fill. */
export const INFORMATIONAL_CODES: ReadonlySet<AdderWarningCode> = new Set([
  "duplicate",
  "overlap",
  "recurring",
]);

export const DATE_CODES: ReadonlySet<AdderWarningCode> = new Set([
  "missing_date",
  "missing_year",
  "invalid_date",
]);
