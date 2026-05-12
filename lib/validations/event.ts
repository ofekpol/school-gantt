import { z } from "zod";

/** Step 1 — Date: single ISO date string (YYYY-MM-DD). */
export const step1Schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
});

/** Step 2 — Grades: 1..6 items from set 7–12. */
export const step2Schema = z.object({
  grades: z
    .array(z.number().int().min(7).max(12))
    .min(1, "At least one grade required"),
});

/** Step 3 — Event type: UUID of an event_types row. */
export const step3Schema = z.object({
  eventTypeId: z.string().uuid("Invalid event type"),
});

/** Step 4 — Title: 1–120 chars. */
export const step4Schema = z.object({
  title: z.string().min(1).max(120),
});

/** Step 5 base shape (without cross-field refinement) — reused for merges. */
const step5Base = z.object({
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  allDay: z.boolean(),
});

/** Step 5 — Time: ISO datetime strings; all-day toggle. */
export const step5Schema = step5Base.refine(
  (d) => new Date(d.startAt) < new Date(d.endAt),
  { message: "Start must be before end", path: ["endAt"] },
);

/** Step 6 — Responsible person + requirements. */
export const step6Schema = z.object({
  responsibleText: z.string().min(1).max(80),
  requirementsText: z.string().max(2000).optional(),
});

/** Step 7 (summary) — full merge used for submit validation. */
export const step7Schema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Base)
  .merge(step6Schema)
  .refine((d) => new Date(d.startAt) < new Date(d.endAt), {
    message: "Start must be before end",
    path: ["endAt"],
  });

/** Full draft schema (all fields optional — supports partial wizard saves). */
export const eventDraftSchema = z.object({
  date: step1Schema.shape.date.optional(),
  grades: step2Schema.shape.grades.optional(),
  eventTypeId: step3Schema.shape.eventTypeId.optional(),
  title: step4Schema.shape.title.optional(),
  startAt: step5Base.shape.startAt.optional(),
  endAt: step5Base.shape.endAt.optional(),
  allDay: step5Base.shape.allDay.optional(),
  responsibleText: step6Schema.shape.responsibleText.optional(),
  requirementsText: step6Schema.shape.requirementsText.optional(),
});

export type EventDraftInput = z.infer<typeof eventDraftSchema>;
export type Step7Input = z.infer<typeof step7Schema>;
